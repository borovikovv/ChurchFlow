# User and organization member profiles

`User` stores platform-wide identity data. Baptism date and baptism church name belong to the
user and can be edited by that user. `OrganizationMemberProfile` stores information owned by one
organization, including the historical membership date, biography, family notes, and profile photo.
The technical `OrganizationMember.joinedAt` timestamp is not a historical membership date.

Only an active organization OWNER or ADMIN can edit organization member profiles, photos, or
relationships. Biography, family notes, and relationships are omitted from member-list responses
for other roles.

## Relationships

Relationships connect two non-removed memberships in the same organization. `SPOUSE` and
`SIBLING` are symmetric and stored with membership IDs in lexical order. `PARENT` is canonical:
the `from` membership is the parent and `to` is the child. A submitted `CHILD` relationship is
converted to that canonical `PARENT` representation. Self-links and duplicates are rejected.

## Member photos

Photos are private S3-compatible objects. The API creates a five-minute presigned PUT URL for JPEG,
PNG, or WebP files up to 5 MB. Confirmation performs `HeadObject` and compares MIME type and size
before attaching the asset. Read URLs expire after five minutes. Replaced assets are soft-deleted.
