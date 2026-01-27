# Updown

## Project structure

- `hi-lo-client`: player UI
- `hi-lo-admin`: admin UI (static HTML served by `GET /admin`)
- `hi-lo-merchant`: merchant portal UI (placeholder)
- `hi-lo-server`: API services

The admin HTML lives in `hi-lo-admin/admin-page.html`. The server reads that file at runtime and serves it from `GET /admin`.
