//! Convert PostgreSQL row values into JSON-friendly `serde_json::Value`s.
//!
//! The grid renders deterministically, so non-numeric/boolean values are emitted as strings (the
//! frontend treats timestamps, uuids, json, etc. as opaque text and copy-as-JSON round-trips).
//! Types are matched by name, which is stable across PostgreSQL versions.

use serde_json::Value;
use tokio_postgres::Row;

/// Convert every column of a row into a JSON array.
pub fn row_to_json(row: &Row) -> Vec<Value> {
    (0..row.len()).map(|i| cell_to_json(row, i)).collect()
}

fn cell_to_json(row: &Row, idx: usize) -> Value {
    let ty = row.columns()[idx].type_();

    macro_rules! opt {
        ($t:ty) => {
            row.try_get::<usize, Option<$t>>(idx).ok().flatten()
        };
    }

    match ty.name() {
        "bool" => opt!(bool).map(Value::Bool).unwrap_or(Value::Null),
        "int2" => num(opt!(i16).map(|v| v as i64)),
        "int4" => num(opt!(i32).map(|v| v as i64)),
        "int8" => num(opt!(i64)),
        "oid" => num(opt!(u32).map(|v| v as i64)),
        "float4" => numf(opt!(f32).map(|v| v as f64)),
        "float8" => numf(opt!(f64)),
        "numeric" => text(opt!(rust_decimal::Decimal).map(|d| d.to_string())),
        "json" | "jsonb" => opt!(Value).unwrap_or(Value::Null),
        "uuid" => text(opt!(uuid::Uuid).map(|u| u.to_string())),
        "timestamp" => text(opt!(chrono::NaiveDateTime).map(|t| t.to_string())),
        "timestamptz" => text(opt!(chrono::DateTime<chrono::Utc>).map(|t| t.to_rfc3339())),
        "date" => text(opt!(chrono::NaiveDate).map(|t| t.to_string())),
        "time" => text(opt!(chrono::NaiveTime).map(|t| t.to_string())),
        "bytea" => text(opt!(Vec<u8>).map(|b| format!("\\x{}", to_hex(&b)))),
        // text-like types and anything castable to a string
        "text" | "varchar" | "bpchar" | "char" | "name" | "citext" | "unknown" => {
            text(opt!(String))
        }
        _ => {
            // Last resort: try a string decode, otherwise surface the type name.
            match row.try_get::<usize, Option<String>>(idx) {
                Ok(Some(s)) => Value::String(s),
                Ok(None) => Value::Null,
                Err(_) => Value::String(format!("[{}]", ty.name())),
            }
        }
    }
}

fn num(v: Option<i64>) -> Value {
    v.map(|n| Value::Number(n.into())).unwrap_or(Value::Null)
}

fn numf(v: Option<f64>) -> Value {
    match v {
        Some(f) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        None => Value::Null,
    }
}

fn text(v: Option<String>) -> Value {
    v.map(Value::String).unwrap_or(Value::Null)
}

fn to_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}
