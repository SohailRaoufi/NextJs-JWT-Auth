# nextjs-jwt-auth

A minimal example implementation of JWT authentication in Next.js 15 using the App Router, jose for JWT operations, and Prisma for database access.

## Features

- 🔒 JWT authentication using jose
- 🚀 Works with Next.js 15 App Router
- 💾 Prisma integration with accelerate extension
- 🔑 Secure password hashing with argon2
- ✅ Request validation with zod
- 📝 TypeScript support

## Getting Started

### Prerequisites

- Node.js 18+
- npm/yarn/pnpm
- Docker (optional, for local database)

### Installation

1. Clone this repository

```bash
git clone https://github.com/SohailRaoufi/NextJs-JWT-Auth.git
cd nextjs-jwt-auth
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

```bash
cp .env.example .env
```

4. Start the database and run migrations

```bash
docker-compose up -d
npx prisma migrate dev
```

5. Seed the database with test user

```bash
npx prisma db seed
```

6. Start the development server

```bash
npm run dev
```

### Test User Credentials

```
Email: test@gmail.com
Password: test12345
```

## Usage Example

### Protected API Route

```typescript
// app/api/examples/user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    return NextResponse.json({
      message: 'This is a protected endpoint',
      user,
    });
  });
}
```

### Making Authenticated Requests

```typescript
// From your client code
async function fetchProtectedData(token) {
  const response = await fetch('/api/examples/user', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}
```

## Key Dependencies

```json
{
  "dependencies": {
    "@prisma/extension-accelerate": "^1.3.0",
    "argon2": "^0.41.1",
    "jose": "^6.0.10",
    "next": "15.2.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "prisma": "^6.5.0",
    "typescript": "^5"
  }
}
```

## Security Recommendations

- Store JWT secret in environment variables
- Use HTTPS in production
- Set appropriate token expiration times (short-lived tokens)
- Consider implementing refresh tokens for longer sessions
- Add rate limiting to authentication endpoints
- Log authentication failures and suspicious activities

## Customization

This example demonstrates a basic JWT implementation. For real-world use, consider:

1. **Token Storage Options**:

   - HTTP-only cookies (XSS protection)
   - Authorization header (used in this example)
   - Stores like zustand for local storage support

2. **Enhanced Security**:

   - CSRF protection
   - Refresh token mechanism
   - Token revocation strategy

3. **User Management**:
   - Role-based access control
   - Account recovery flows
   - Email verification

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
