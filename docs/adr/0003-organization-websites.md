# ADR 0003: Organization Websites

## Status

Accepted

## Decision

Each organization can own one website with pages, sections, media, settings, and future custom domains. Public website content is stored separately from private CRM/member data.

## Consequences

Public rendering can safely query published website records without accessing private tenant administration tables. Dashboard editing requires `website.manage`.
