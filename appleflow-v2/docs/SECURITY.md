# AppleFlow POS - Security Guide

Comprehensive security documentation for AppleFlow POS.

---

## 🔐 Security Overview

AppleFlow POS implements enterprise-grade security measures:

- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Row Level Security (RLS) in PostgreSQL
- **API Security**: Rate limiting, input validation
- **Transport Security**: HTTPS/TLS
- **Password Security**: bcrypt hashing

---

## Authentication

### JWT Token Structure

```
Access Token: Valid for 8 hours
Refresh Token: Valid for 7 days
```

### Token Flow

1. User logs in with email + PIN
2. Server validates credentials
3. Server issues access + refresh tokens
4. Frontend stores tokens securely
5. Access token sent with each request
6. Auto-refresh when access token expires

### PIN Requirements

- Minimum 4 digits
- Maximum 6 digits
- bcrypt hashed (12 rounds)
- Never stored in plain text

---

## Authorization

### Role Hierarchy

```
super_admin (100)      → SaaS operator access
tenant_admin (90)      → Full tenant access
manager (70)           → Products, inventory, reports
supervisor (60)        → Inventory, reports
cashier (40)           → Sales processing
staff (20)             → Basic access
```

### Permission Inheritance

Higher roles inherit permissions from lower roles.

### API Route Protection

```typescript
// Example: Manager-only route
app.put('/api/products/:id', 
  authenticate,           // Verify JWT
  requireRole('manager'), // Check role
  updateProduct
);
```

---

## Database Security

### Row Level Security (RLS)

All tables have RLS policies ensuring users only see their tenant's data:

```sql
-- Example RLS policy
CREATE POLICY tenant_isolation ON products
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

### Tenant Isolation

- Each request sets tenant context
- All queries filtered by tenant_id
- Cross-tenant data access impossible

### SQL Injection Protection

- All queries use parameterized statements
- No string concatenation in SQL
- Input validated with Zod schemas

---

## API Security

### Rate Limiting

```typescript
// 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests'
});
```

### Input Validation

All inputs validated with Zod:

```typescript
const loginSchema = z.object({
  email: z.string().email(),
  pin: z.string().length(4)
});
```

### Security Headers

Helmet middleware adds:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

### CORS Configuration

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## Environment Security

### Required Variables

| Variable | Security Level | Notes |
|----------|---------------|-------|
| `JWT_SECRET` | Critical | 64+ random characters |
| `JWT_REFRESH_SECRET` | Critical | Different from JWT_SECRET |
| `SUPABASE_SERVICE_KEY` | Critical | Never expose to frontend |
| `BCRYPT_ROUNDS` | High | Minimum 12 |

### Never Commit

- `.env` files
- Any secrets or keys
- Database credentials

### Generate Secrets

```bash
# Generate secure random string
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Frontend Security

### Token Storage

- Access token: Memory (Zustand store)
- Refresh token: localStorage
- No sensitive data in localStorage

### XSS Protection

- React's built-in escaping
- No dangerouslySetInnerHTML
- Input sanitization

### CSRF Protection

- JWT in Authorization header (not cookies)
- CORS restricts origins

---

## Deployment Security

### HTTPS Required

All production deployments must use HTTPS:

```nginx
# Redirect HTTP to HTTPS
server {
  listen 80;
  return 301 https://$host$request_uri;
}
```

### Security Headers

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

## Security Checklist

### Pre-Deployment

- [ ] Changed default JWT secrets
- [ ] Using strong bcrypt rounds (12+)
- [ ] CORS origin properly configured
- [ ] Rate limiting enabled
- [ ] Helmet headers active
- [ ] HTTPS configured
- [ ] Database RLS enabled
- [ ] No secrets in code
- [ ] Environment variables set

### Post-Deployment

- [ ] Test authentication flow
- [ ] Verify tenant isolation
- [ ] Check rate limiting works
- [ ] Confirm HTTPS only
- [ ] Review access logs
- [ ] Set up monitoring

---

## Common Vulnerabilities & Mitigations

### SQL Injection

**Risk**: Malicious SQL in user input
**Mitigation**: Parameterized queries, Zod validation

### XSS (Cross-Site Scripting)

**Risk**: Malicious scripts in user input
**Mitigation**: React escaping, input sanitization

### CSRF (Cross-Site Request Forgery)

**Risk**: Unauthorized actions on behalf of user
**Mitigation**: JWT in headers, CORS protection

### Brute Force

**Risk**: PIN/password guessing
**Mitigation**: Rate limiting, account lockout

### Session Hijacking

**Risk**: Stolen tokens used by attacker
**Mitigation**: Short token expiry, HTTPS, secure storage

---

## Incident Response

### If Breach Suspected

1. **Immediate**: Rotate JWT secrets
2. **Short-term**: Force all users to re-login
3. **Investigation**: Review access logs
4. **Communication**: Notify affected users
5. **Prevention**: Fix vulnerability

### Rotating Secrets

```bash
# Generate new secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update environment variables
# Restart services
# All users will need to re-login
```

---

## Audit Logging

The system logs:

- User logins (success/failure)
- Password/PIN changes
- Role changes
- Sensitive data access
- Failed authorization attempts

View logs in Supabase or application logs.

---

## Penetration Testing

Recommended tools for security testing:

- **OWASP ZAP** - Web app security scanner
- **Burp Suite** - Web vulnerability scanner
- **npm audit** - Dependency vulnerabilities

```bash
# Check dependencies
npm audit

# Fix issues
npm audit fix
```

---

## Compliance

### Data Protection

- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Implement proper access controls

### PCI DSS (if handling cards)

- Never store card numbers
- Use tokenization
- Follow PCI guidelines

---

## Security Contacts

Report security issues to:
- Email: security@appleflow.pos
- GitHub: Private security advisory

---

**Last Updated**: 2024
**Version**: 2.0
