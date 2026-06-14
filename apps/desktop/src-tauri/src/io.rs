//! CSV / JSON import & export.

use std::path::Path;

use serde_json::{Map, Value};
use tokio_postgres::Client;

use crate::error::{AppError, AppResult};
use crate::models::QueryResult;

/// Write a query result to `path` in the given `format` ("csv" | "json"). Returns rows written.
pub fn export(result: &QueryResult, format: &str, path: &Path) -> AppResult<usize> {
    match format {
        "json" => export_json(result, path),
        "csv" => export_csv(result, path),
        other => Err(AppError::Other(format!(
            "unsupported export format: {other}"
        ))),
    }
}

fn export_json(result: &QueryResult, path: &Path) -> AppResult<usize> {
    let records: Vec<Value> = result
        .rows
        .iter()
        .map(|row| {
            let mut obj = Map::new();
            for (i, field) in result.fields.iter().enumerate() {
                obj.insert(
                    field.name.clone(),
                    row.get(i).cloned().unwrap_or(Value::Null),
                );
            }
            Value::Object(obj)
        })
        .collect();
    std::fs::write(path, serde_json::to_string_pretty(&records)?)?;
    Ok(records.len())
}

fn export_csv(result: &QueryResult, path: &Path) -> AppResult<usize> {
    let mut writer = csv::Writer::from_path(path)?;
    writer.write_record(result.fields.iter().map(|f| f.name.as_str()))?;
    for row in &result.rows {
        writer.write_record(row.iter().map(cell_to_csv))?;
    }
    writer.flush()?;
    Ok(result.rows.len())
}

fn cell_to_csv(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

/// Import a CSV file into `schema.table`. When `has_header` is true the first row names the columns;
/// otherwise the file's column order must match the table's.
pub async fn import_csv(
    client: &Client,
    schema: &str,
    table: &str,
    path: &Path,
    has_header: bool,
) -> AppResult<usize> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(has_header)
        .from_path(path)?;

    let headers: Vec<String> = if has_header {
        reader.headers()?.iter().map(|s| s.to_string()).collect()
    } else {
        // Fall back to the table's column order.
        let rel = format!(
            "\"{}\".\"{}\"",
            schema.replace('"', "\"\""),
            table.replace('"', "\"\"")
        );
        client
            .query(
                "SELECT a.attname FROM pg_attribute a
                 WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
                 ORDER BY a.attnum",
                &[&rel],
            )
            .await?
            .iter()
            .map(|r| r.get::<_, String>(0))
            .collect()
    };

    let rel = format!(
        "\"{}\".\"{}\"",
        schema.replace('"', "\"\""),
        table.replace('"', "\"\"")
    );
    let cols = headers
        .iter()
        .map(|c| format!("\"{}\"", c.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(", ");

    let mut imported = 0usize;
    for record in reader.records() {
        let record = record?;
        let values = record
            .iter()
            .map(|v| {
                if v.is_empty() {
                    "NULL".to_string()
                } else {
                    format!("'{}'", v.replace('\'', "''"))
                }
            })
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!("INSERT INTO {rel} ({cols}) VALUES ({values})");
        client.execute(&sql, &[]).await?;
        imported += 1;
    }
    Ok(imported)
}
