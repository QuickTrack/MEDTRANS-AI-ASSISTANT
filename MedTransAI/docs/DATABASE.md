# Database Schema

SQLite file: `database/medtrans.db` (configurable in `config/settings.json`).

## tables

### tasks
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| external_id | TEXT UNIQUE | website task id |
| project_name | TEXT | |
| clip_number | TEXT | |
| duration_seconds | REAL | |
| speaker | TEXT | |
| tag | TEXT | |
| status | TEXT | pending / draft / completed |
| created_at | TEXT | ISO-8601 UTC |
| updated_at | TEXT | ISO-8601 UTC |

### drafts
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| task_id | INTEGER FK → tasks.id | |
| content | TEXT | transcript text |
| word_count | INTEGER | |
| char_count | INTEGER | |
| confidence | REAL | 0..1 |
| created_at / updated_at | TEXT | |

### exports
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| task_id | INTEGER FK | |
| format | TEXT | docx/pdf/txt/json/csv |
| path | TEXT | absolute output path |
| created_at | TEXT | |

### statistics
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| date | TEXT | |
| jobs_completed / jobs_remaining | INTEGER | |
| success_rate / avg_accuracy / avg_processing_seconds | REAL | |
| storage_bytes | INTEGER | |

### activity
| column | type | |
|--------|------|---|
| id | INTEGER PK | |
| ts | TEXT | |
| action | TEXT | |
| detail | TEXT | |

### errors
| column | type | |
|--------|------|---|
| id | INTEGER PK | |
| ts | TEXT | |
| level | TEXT | |
| message | TEXT | |
| trace | TEXT | |

### settings
| column | type | |
|--------|------|---|
| key | TEXT PK | |
| value | TEXT | arbitrary key/value |

## relationships
- `drafts.task_id → tasks.id` (CASCADE)
- `exports.task_id → tasks.id`

## indexes / pragmas
- `journal_mode = WAL`
- `foreign_keys = ON`
- `external_id` has a UNIQUE index for idempotent browser sync.
