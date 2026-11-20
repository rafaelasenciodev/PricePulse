-- The schema of feature 11. Money is an integer of minor units and a currency, and an instant is an integer of
-- milliseconds, as in the domain. A column that holds an identifier or a comparison key uses the collation "C", which
-- compares by the codes of the characters, so the order does not depend on the machine (BR-06).
-- There are no foreign keys: the modules refer to each other by identifier only.
-- The constraints are named, because the adapters tell a violation from another by its name.

CREATE TABLE accounts (
  id            text COLLATE "C" PRIMARY KEY,
  email         text COLLATE "C" NOT NULL,
  password_hash text NOT NULL,
  CONSTRAINT accounts_email_key UNIQUE (email)
);

CREATE TABLE sessions (
  token_hash text COLLATE "C" PRIMARY KEY,
  user_id    text COLLATE "C" NOT NULL,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- `written` is the order in which the rows were written: the adapter drops the oldest beyond its capacity.
CREATE SEQUENCE login_attempts_written_seq;
CREATE TABLE login_attempts (
  email        text COLLATE "C" PRIMARY KEY,
  count        integer NOT NULL,
  locked_until bigint,
  written      bigint NOT NULL DEFAULT nextval('login_attempts_written_seq')
);
CREATE INDEX login_attempts_written_idx ON login_attempts (written);

CREATE TABLE listings (
  id       text COLLATE "C" PRIMARY KEY,
  title    text NOT NULL,
  -- The title in lower case as the domain makes it, so that the order is the domain's and not the database's.
  title_key text COLLATE "C" NOT NULL,
  retailer text NOT NULL,
  currency text COLLATE "C" NOT NULL
);
CREATE INDEX listings_title_key_idx ON listings (title_key, id);

CREATE TABLE price_alerts (
  id                 text COLLATE "C" PRIMARY KEY,
  owner              text COLLATE "C" NOT NULL,
  listing_id         text COLLATE "C" NOT NULL,
  target_minor_units bigint NOT NULL,
  currency           text COLLATE "C" NOT NULL,
  status             text NOT NULL,
  created_at         bigint NOT NULL,
  CONSTRAINT price_alerts_target_positive CHECK (target_minor_units > 0),
  CONSTRAINT price_alerts_status_known CHECK (status IN ('active', 'triggered', 'cancelled'))
);
-- One Active alert for an owner and a Listing (BR-07).
CREATE UNIQUE INDEX price_alerts_one_active_idx ON price_alerts (owner, listing_id) WHERE status = 'active';
CREATE INDEX price_alerts_owner_idx ON price_alerts (owner, created_at DESC, id);
CREATE INDEX price_alerts_active_listing_idx ON price_alerts (listing_id) WHERE status = 'active';

CREATE TABLE notifications (
  alert_id            text COLLATE "C" PRIMARY KEY,
  owner               text COLLATE "C" NOT NULL,
  listing_id          text COLLATE "C" NOT NULL,
  currency            text COLLATE "C" NOT NULL,
  target_minor_units  bigint NOT NULL,
  current_minor_units bigint NOT NULL,
  observed_at         bigint NOT NULL
);
CREATE INDEX notifications_owner_idx ON notifications (owner, observed_at DESC, alert_id);

CREATE TABLE price_observations (
  provider          text COLLATE "C" NOT NULL,
  listing_id        text COLLATE "C" NOT NULL,
  observed_at       bigint NOT NULL,
  -- Both empty when the Listing had no price at that moment.
  price_minor_units bigint,
  currency          text COLLATE "C",
  PRIMARY KEY (provider, listing_id, observed_at),
  CONSTRAINT price_observations_price_complete CHECK ((price_minor_units IS NULL) = (currency IS NULL))
);
CREATE INDEX price_observations_listing_idx ON price_observations (listing_id, observed_at DESC, provider);
