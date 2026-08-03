import { PrismaClient, Role, TableStatus } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear Existing Data (dependency order first)
  console.log('🧹 Cleaning database...');
  await prisma.serviceRequest.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.qRCode.deleteMany({});
  await prisma.restaurantTable.deleteMany({});
  // await prisma.menuItem.deleteMany({});
  // await prisma.subCategory.deleteMany({});
  // await prisma.category.deleteMany({});
  await prisma.restaurantSetting.deleteMany({});
  await prisma.coupon.deleteMany({});
  await prisma.verification.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.waiterTable.deleteMany({});
  await prisma.waiter.deleteMany({});
  await prisma.admin.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.restaurant.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Default Restaurant & Branch & Settings
  console.log('⚙️ Seeding restaurant and branch...');
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Bikaji Group',
      description: 'Bikaji Premium Indian Dining and Catering'
    }
  });

  const branch = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Bikaji Main Branch',
      address: 'Paupat Road, Bikaner, Rajasthan',
      phone: '+91 98765 43210',
      email: 'main@bikaji.com'
    }
  });

  await prisma.restaurantSetting.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Bikaji Premium Indian Dining',
      gstRate: 5.0, // 5% GST
      serviceChargeRate: 5.0, // 5% Service Charge
      currency: 'INR',
    },
  });

  // 3. Tables Seeding (Table 1 to 8)
  console.log('🪑 Seeding tables...');
  const tableData = Array.from({ length: 8 }, (_, i) => ({
    branchId: branch.id,
    number: i + 1,
    capacity: 4,
    status: TableStatus.FREE,
  }));
  for (const table of tableData) {
    await prisma.restaurantTable.create({
      data: table,
    });
  }

  // 4. Coupons Seeding
  console.log('🏷️ Seeding coupons...');
  await prisma.coupon.createMany({
    data: [
      {
        branchId: branch.id,
        code: 'WELCOME10',
        discountPercent: 10.0,
        discountValue: 10.0,
        minOrderAmount: 500,
        isActive: true,
      },
      {
        branchId: branch.id,
        code: 'BIKAJIFESTIVE',
        discountPercent: 15.0,
        discountValue: 15.0,
        maxDiscount: 300,
        minOrderAmount: 1200,
        isActive: true,
      },
      {
        branchId: branch.id,
        code: 'ROYAL20',
        discountPercent: 20.0,
        discountValue: 20.0,
        maxDiscount: 500,
        minOrderAmount: 2000,
        isActive: true,
      },
    ],
  });

  // Demo menu seeding removed to prevent overwriting production custom menu data.
  // 6. Users & Credentials Accounts Seeding
  console.log('👤 Seeding staff users & profiles...');
  const defaultPassword = "password123";
  const hashedPassword = await hashPassword(defaultPassword);

  // Helper to create a user + credential account pair
  async function createStaffUser(
    name: string,
    email: string,
    localEmail: string,
    role: Role
  ) {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        emailVerified: true,
        role,
      },
    });

    // Better Auth uses providerId: "credential" and accountId: userId
    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: 'credential',  // MUST be 'credential' — Better Auth checks this
        accountId: user.id,        // MUST be userId — Better Auth sets this on sign-up
        password: hashedPassword,
      },
    });

    // Also create an alias account for @bikaji.local email
    if (localEmail !== email) {
      const localUser = await prisma.user.create({
        data: {
          name,
          email: localEmail,
          emailVerified: true,
          role,
        },
      });
      await prisma.account.create({
        data: {
          userId: localUser.id,
          providerId: 'credential',
          accountId: localUser.id,
          password: hashedPassword,
        },
      });
      return { user, localUser };
    }

    return { user };
  }

  // User 1: Admin
  const { user: adminUser } = await createStaffUser(
    'Admin User',
    'admin@bikaji.com',
    'admin@bikaji.local',
    Role.ADMIN
  );

  await prisma.admin.create({
    data: { userId: adminUser.id, branchId: branch.id },
  });

  // User 2: Waiter
  const { user: waiterUser } = await createStaffUser(
    'Waiter Rajesh',
    'waiter@bikaji.com',
    'waiter@bikaji.local',
    Role.WAITER
  );

  await prisma.waiter.create({
    data: {
      userId: waiterUser.id,
      branchId: branch.id,
      employeeId: 'EMP-WAITER-01',
      isAvailable: true,
    },
  });

  // User 3: Kitchen
  await createStaffUser(
    'Chef Kapoor',
    'kitchen@bikaji.com',
    'kitchen@bikaji.local',
    Role.KITCHEN
  );

  // User 4: Restaurant Manager
  const { user: managerUser } = await createStaffUser(
    'Manager Malhotra',
    'manager@bikaji.com',
    'manager@bikaji.local',
    Role.ADMIN
  );

  await prisma.admin.create({
    data: { userId: managerUser.id, branchId: branch.id },
  });

  // User 5: Cashier
  await createStaffUser(
    'Cashier Sharma',
    'cashier@bikaji.com',
    'cashier@bikaji.local',
    Role.CASHIER
  );

  console.log('');
  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('📋 Login Credentials (all use password: password123)');
  console.log('  Admin     → admin@bikaji.com   or admin@bikaji.local');
  console.log('  Waiter    → waiter@bikaji.com  or waiter@bikaji.local');
  console.log('  Kitchen   → kitchen@bikaji.com or kitchen@bikaji.local');
  console.log('  Manager   → manager@bikaji.com or manager@bikaji.local');
  console.log('  Cashier   → cashier@bikaji.com or cashier@bikaji.local');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
