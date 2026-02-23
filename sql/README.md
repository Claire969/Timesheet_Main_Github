# SQL Migrations

Ce dossier contient les migrations SQL pour la base de données Timesheet.

## Prérequis

- Accès au serveur hébergeant le container Docker Supabase
- Accès SSH ou console au serveur
- Le container PostgreSQL Supabase doit être en cours d'exécution

## Application de la migration

### Méthode 1: Via psql dans le container Docker

1. **Se connecter au serveur** (si distant)

```bash
ssh user@your-server.com
```

2. **Trouver le nom du container PostgreSQL Supabase**

```bash
docker ps | grep supabase
# Chercher le container avec "supabase_db" dans le nom
```

3. **Exécuter la migration**

```bash
# Depuis le répertoire contenant le fichier SQL
docker exec -i supabase_db_repo psql -U postgres -d postgres < sql/001_timesheet_init.sql
```

Ou de manière interactive:

```bash
# Copier le fichier dans le container
docker cp sql/001_timesheet_init.sql supabase_db_repo:/tmp/

# Se connecter au container
docker exec -it supabase_db_repo psql -U postgres -d postgres

# Dans psql, exécuter:
\i /tmp/001_timesheet_init.sql
\q
```

### Méthode 2: Via Supabase Studio (Interface Web)

1. Ouvrir Supabase Studio dans votre navigateur
2. Aller dans "SQL Editor"
3. Copier-coller le contenu de `001_timesheet_init.sql`
4. Cliquer sur "Run" pour exécuter

### Méthode 3: Via l'outil Supabase CLI (si installé)

```bash
supabase db push
```

## Vérification de la migration

Après avoir appliqué la migration, vérifiez que tout est en place:

```sql
-- Vérifier que le schema existe
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'timesheet';

-- Vérifier que la table existe
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'timesheet' AND table_name = 'entries';

-- Vérifier les policies RLS
SELECT policyname, tablename FROM pg_policies
WHERE schemaname = 'timesheet' AND tablename = 'entries';

-- Vérifier les indexes
SELECT indexname FROM pg_indexes
WHERE schemaname = 'timesheet' AND tablename = 'entries';
```

## Rollback (en cas de problème)

Si vous devez annuler la migration:

```sql
-- Supprimer les policies RLS
DROP POLICY IF EXISTS "Users can view own entries" ON timesheet.entries;
DROP POLICY IF EXISTS "Users can create own entries" ON timesheet.entries;
DROP POLICY IF EXISTS "Users can update own entries" ON timesheet.entries;
DROP POLICY IF EXISTS "Users can delete own entries" ON timesheet.entries;

-- Supprimer le trigger
DROP TRIGGER IF EXISTS update_entries_updated_at ON timesheet.entries;

-- Supprimer la fonction
DROP FUNCTION IF EXISTS timesheet.update_updated_at_column();

-- Supprimer la table
DROP TABLE IF EXISTS timesheet.entries;

-- Supprimer le schema (seulement s'il est vide)
DROP SCHEMA IF EXISTS timesheet CASCADE;
```

## Migrations futures

Pour ajouter de nouvelles migrations:

1. Créer un nouveau fichier avec un numéro séquentiel: `002_description.sql`
2. Toujours inclure un commentaire en en-tête expliquant les changements
3. Utiliser `IF NOT EXISTS` ou `IF EXISTS` pour éviter les erreurs
4. Tester la migration sur un environnement de développement d'abord
5. Documenter les changements dans ce README

## Structure de la table timesheet.entries

| Colonne        | Type         | Description                          |
|----------------|--------------|--------------------------------------|
| id             | uuid         | Identifiant unique (PK)              |
| user_id        | uuid         | Référence vers auth.users (FK)       |
| entry_date     | date         | Date de l'entrée timesheet           |
| start_time     | time         | Heure de début                       |
| end_time       | time         | Heure de fin                         |
| break_minutes  | integer      | Durée de pause en minutes            |
| title          | text         | Titre court de l'activité            |
| notes          | text         | Notes détaillées (optionnel)         |
| created_at     | timestamptz  | Date de création                     |
| updated_at     | timestamptz  | Date de dernière modification        |

## Contraintes

- `end_time` doit être >= `start_time`
- `break_minutes` doit être >= 0
- Row Level Security activé: chaque utilisateur ne peut voir/modifier que ses propres entrées
