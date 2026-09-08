"""SQLite-backed D1 test adapter. In-memory fixtures only; no remote access."""
import json
import sqlite3
import sys

db = sqlite3.connect(':memory:')
db.row_factory = sqlite3.Row
db.execute('PRAGMA foreign_keys = ON')
for line in sys.stdin:
    request = json.loads(line)
    try:
        if request['method'] == 'exec':
            db.executescript(request['sql'])
            result = {'success': True}
        else:
            cursor = db.execute(request['sql'], request.get('params', []))
            rows = [dict(row) for row in cursor.fetchall()] if cursor.description else []
            changes = db.execute('SELECT changes()').fetchone()[0]
            db.commit()
            result = rows[0] if request['method'] == 'first' and rows else None if request['method'] == 'first' else {'success': True, 'results': rows, 'meta': {'changes': changes}}
        print(json.dumps({'id': request['id'], 'result': result}), flush=True)
    except Exception as error:
        db.rollback()
        print(json.dumps({'id': request['id'], 'error': str(error)}), flush=True)
