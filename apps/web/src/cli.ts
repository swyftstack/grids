/**
 * Operational CLI for the self-hosted server, exposed in the Docker image as the commands:
 *
 *   docker exec swyftgrids reset-password         → issue a temporary password (force change)
 *   docker exec swyftgrids reset-admin-password   → set a new password interactively
 *   docker exec swyftgrids create-admin           → create the admin account (only if none exists)
 *   docker exec swyftgrids disable-auth           → turn on the authentication bypass
 *   docker exec swyftgrids enable-auth            → turn the bypass back off
 *
 * These never send email or touch external services — recovery is entirely local.
 */
import { loadAuthConfig } from './auth/config.js';
import { AuthStore, META_AUTH_DISABLED } from './auth/store.js';
import {
  generateTempPassword,
  hashPassword,
  validateEmail,
  validatePassword,
} from './auth/passwords.js';

const KEY_EOF = String.fromCharCode(4); // Ctrl-D / EOF
const KEY_CTRL_C = String.fromCharCode(3);
const KEY_BACKSPACE = String.fromCharCode(127);

function ask(query: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(query);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (data) => {
      process.stdin.pause();
      resolve(String(data).replace(/\r?\n$/, ''));
    });
  });
}

/** Prompt for a secret, masking keystrokes when attached to a TTY. */
function askHidden(query: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) return ask(query);
  return new Promise((resolve) => {
    process.stdout.write(query);
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (key: string) => {
      if (key === '\n' || key === '\r' || key === KEY_EOF) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (key === KEY_CTRL_C) {
        process.stdout.write('\n');
        process.exit(1);
      } else if (key === KEY_BACKSPACE || key === '\b') {
        value = value.slice(0, -1);
      } else {
        value += key;
      }
    };
    stdin.on('data', onData);
  });
}

async function promptNewPassword(): Promise<string> {
  for (;;) {
    const password = await askHidden('New password: ');
    const error = validatePassword(password);
    if (error) {
      console.error(`  ${error}`);
      continue;
    }
    const confirm = await askHidden('Confirm password: ');
    if (password !== confirm) {
      console.error('  Passwords do not match');
      continue;
    }
    return password;
  }
}

async function main() {
  const command = process.argv[2];
  const config = loadAuthConfig();
  const store = new AuthStore(config.dataDir);

  switch (command) {
    case 'reset-password': {
      const user = store.getUser();
      if (!user) {
        console.error('No admin account exists. Run `create-admin` first.');
        process.exit(1);
      }
      const temp = generateTempPassword();
      store.updatePassword(user.id, await hashPassword(temp), true);
      store.deleteAllSessions();
      console.log('\nTemporary password:\n');
      console.log(`    ${temp}\n`);
      console.log('The user must set a new password on next login.\n');
      break;
    }

    case 'reset-admin-password': {
      const user = store.getUser();
      if (!user) {
        console.error('No admin account exists. Run `create-admin` first.');
        process.exit(1);
      }
      const argPassword = process.argv[3];
      const password = argPassword ?? (await promptNewPassword());
      const error = validatePassword(password);
      if (error) {
        console.error(error);
        process.exit(1);
      }
      store.updatePassword(user.id, await hashPassword(password), false);
      store.deleteAllSessions();
      console.log('Password updated successfully.');
      break;
    }

    case 'create-admin': {
      if (store.userCount() > 0) {
        console.error('An admin account already exists. Only one account is supported.');
        process.exit(1);
      }
      const email = process.argv[3] ?? (await ask('Email: '));
      if (!validateEmail(email)) {
        console.error('Invalid email address.');
        process.exit(1);
      }
      const password = process.argv[4] ?? (await promptNewPassword());
      const error = validatePassword(password);
      if (error) {
        console.error(error);
        process.exit(1);
      }
      store.createUser(email, await hashPassword(password));
      console.log(`Admin account created for ${email}.`);
      break;
    }

    case 'disable-auth': {
      store.setMeta(META_AUTH_DISABLED, 'true');
      console.log('Authentication disabled. A restart is not required.');
      console.log('Only use this behind a trusted network, VPN, or authenticating proxy.');
      break;
    }

    case 'enable-auth': {
      store.setMeta(META_AUTH_DISABLED, 'false');
      console.log('Authentication enabled.');
      break;
    }

    default:
      console.error(
        'Usage: <reset-password | reset-admin-password | create-admin | disable-auth | enable-auth>',
      );
      process.exit(1);
  }

  store.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
