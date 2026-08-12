package com.fieldtrack.employee.tracking

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

internal class LocationQueue(context: Context) : SQLiteOpenHelper(context, "field_track_points.db", null, 1) {
  override fun onCreate(database: SQLiteDatabase) {
    database.execSQL("CREATE TABLE pending_points (id TEXT PRIMARY KEY, recorded_at TEXT NOT NULL, payload TEXT NOT NULL)")
    database.execSQL("CREATE INDEX pending_points_recorded ON pending_points(recorded_at)")
  }

  override fun onUpgrade(database: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

  fun enqueue(point: JSONObject) {
    writableDatabase.execSQL(
      "INSERT OR IGNORE INTO pending_points (id, recorded_at, payload) VALUES (?, ?, ?)",
      arrayOf(point.getString("id"), point.getString("recordedAt"), point.toString()),
    )
    writableDatabase.execSQL("DELETE FROM pending_points WHERE id IN (SELECT id FROM pending_points ORDER BY recorded_at DESC LIMIT -1 OFFSET 20000)")
  }

  fun oldest(limit: Int = 50): List<JSONObject> {
    val points = mutableListOf<JSONObject>()
    readableDatabase.rawQuery(
      "SELECT payload FROM pending_points ORDER BY recorded_at LIMIT ?",
      arrayOf(limit.toString()),
    ).use { cursor -> while (cursor.moveToNext()) points.add(JSONObject(cursor.getString(0))) }
    return points
  }

  fun remove(ids: List<String>) {
    if (ids.isEmpty()) return
    writableDatabase.beginTransaction()
    try {
      ids.forEach { writableDatabase.delete("pending_points", "id = ?", arrayOf(it)) }
      writableDatabase.setTransactionSuccessful()
    } finally { writableDatabase.endTransaction() }
  }

  fun count(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM pending_points", null).use { cursor ->
    if (cursor.moveToFirst()) cursor.getInt(0) else 0
  }
}
