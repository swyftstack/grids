//! Swyftgrids desktop core.
//!
//! Wires the SQLite application store and the PostgreSQL session pool into Tauri's managed state and
//! registers every command in the IPC contract.

mod analysis;
mod commands;
mod db;
mod error;
mod io;
mod models;
mod store;

use std::collections::HashMap;
use std::fs;
use std::time::Instant;

use db::Pool;
use models::BackupRecord;
use parking_lot::Mutex;
use store::Store;
use tauri::Manager;

/// Shared, thread-safe application state available to every command.
pub struct AppState {
    pub store: Store,
    pub pool: Pool,
    /// In-memory backup records, keyed by connection id (see Backups feature).
    pub backups: Mutex<HashMap<String, Vec<BackupRecord>>>,
    /// Previous transaction counter + timestamp per connection, used to derive monitoring TPS.
    pub mon_prev: Mutex<HashMap<String, (i64, Instant)>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install the rustls crypto provider used for TLS database connections.
    let _ = rustls::crypto::ring::default_provider().install_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let dir = app
                .path()
                .app_data_dir()
                .expect("resolve application data directory");
            fs::create_dir_all(&dir).ok();
            let store = Store::open(&dir.join("swyftgrid.sqlite")).expect("open application store");
            app.manage(AppState {
                store,
                pool: Pool::new(),
                backups: Mutex::new(HashMap::new()),
                mon_prev: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::connections_list,
            commands::connections_save,
            commands::connections_delete,
            commands::connections_duplicate,
            commands::connections_test,
            commands::connections_save_folder,
            commands::connections_delete_folder,
            commands::db_connect,
            commands::db_disconnect,
            commands::db_dashboard,
            commands::schema_tree,
            commands::schema_table,
            commands::schema_snapshot,
            commands::query_execute,
            commands::query_explain,
            commands::query_estimate_impact,
            commands::table_page,
            commands::table_update_row,
            commands::table_insert_row,
            commands::table_delete_row,
            commands::history_list,
            commands::history_add,
            commands::history_toggle_favorite,
            commands::history_clear,
            commands::saved_queries_list,
            commands::saved_queries_save,
            commands::saved_queries_delete,
            commands::saved_queries_duplicate,
            commands::saved_queries_save_folder,
            commands::export_query,
            commands::import_csv,
            commands::settings_get,
            commands::settings_set,
            commands::health_connection,
            commands::health_score,
            commands::indexes_inspect,
            commands::performance_queries,
            commands::timeline_list,
            commands::monitoring_sample,
            commands::dashboards_list,
            commands::dashboards_save,
            commands::dashboards_delete,
            commands::safety_delete_impact,
            commands::backups_list,
            commands::backups_create,
            commands::backups_delete,
            commands::backups_restore,
            commands::diff_schema,
            commands::diff_data,
            commands::ai_run,
            commands::search_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Swyftgrids");
}
