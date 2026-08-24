-- Distinguishes a device the owner signed out from elsewhere from an ordinary logout,
-- which matters when someone asks why a session ended.
ALTER TYPE "SessionRevokeReason" ADD VALUE 'user_revoked';
