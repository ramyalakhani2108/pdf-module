/**
 * @fileoverview Database Seed Script
 * @description Seeds the database with initial data including the default domain
 * registration for the current project to enable internal API access.
 * 
 * Run with: npm run prisma:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Default domain configuration
 * This allows the application itself to access all APIs
 */
const DEFAULT_DOMAIN = {
  domain: 'localhost',
  apiKey: process.env.API_KEY || 'pdf_sk_default_development_key_12345',
  webhook: null,
  isActive: true,
};

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Seed default domain for API access
  console.log('📝 Creating default domain registration...');
  
  const existingDomain = await prisma.apiKey.findUnique({
    where: { domain: DEFAULT_DOMAIN.domain },
  });

  if (existingDomain) {
    console.log(`   ✓ Domain "${DEFAULT_DOMAIN.domain}" already exists`);
    console.log(`   API Key: ${existingDomain.apiKey}`);
  } else {
    const newDomain = await prisma.apiKey.create({
      data: DEFAULT_DOMAIN,
    });
    console.log(`   ✓ Created domain "${newDomain.domain}"`);
    console.log(`   API Key: ${newDomain.apiKey}`);
  }

  // If NEXT_PUBLIC_APP_URL is set, also register that domain
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      const appDomain = url.hostname;
      
      if (appDomain !== DEFAULT_DOMAIN.domain) {
        console.log(`\n📝 Registering app domain: ${appDomain}`);
        
        const existingAppDomain = await prisma.apiKey.findUnique({
          where: { domain: appDomain },
        });

        if (existingAppDomain) {
          console.log(`   ✓ Domain "${appDomain}" already exists`);
        } else {
          const appApiKey = `pdf_sk_${appDomain.replace(/\./g, '_')}_${Date.now()}`;
          await prisma.apiKey.create({
            data: {
              domain: appDomain,
              apiKey: appApiKey,
              webhook: null,
              isActive: true,
            },
          });
          console.log(`   ✓ Created domain "${appDomain}"`);
          console.log(`   API Key: ${appApiKey}`);
        }
      }
    } catch (e) {
      console.log(`   ⚠ Could not parse NEXT_PUBLIC_APP_URL: ${appUrl}`);
    }
  }

  console.log('\n✅ Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
