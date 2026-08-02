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
  await prisma.menuItem.deleteMany({});
  await prisma.subCategory.deleteMany({});
  await prisma.category.deleteMany({});
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

  // 5. Categories & Menu Items Seeding
  console.log('🍽️ Seeding menu categories and items...');

  // Category 1: Starters & Kebabs
  const starters = await prisma.category.create({
    data: {
      branchId: branch.id,
      name: 'Starters & Kebabs',
      description: 'Luxury clay-oven tandoor delicacies and authentic pan-fried kebabs.',
      image: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80',
      order: 1,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        branchId: branch.id,
        categoryId: starters.id,
        name: 'Paneer Tikka Multani',
        description: 'Premium cottage cheese cubes marinated in yellow chili, cream cheese, and chargrilled.',
        price: 375.0,
        offerPrice: 345.0,
        image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isBestseller: true,
        isSpecial: false,
        preparationTime: 12,
      },
      {
        branchId: branch.id,
        categoryId: starters.id,
        name: 'Murgh Malai Kebab',
        description: 'Tender chicken breast pieces marinated in rich cashew paste, cardamom, and toasted cheese.',
        price: 450.0,
        image: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isBestseller: false,
        isSpecial: true,
        preparationTime: 15,
      },
      {
        branchId: branch.id,
        categoryId: starters.id,
        name: 'Hara Bhara Kebab',
        description: 'Delicate pan-seared patties of spinach, green peas, and potato spiced with aromatic herbs.',
        price: 325.0,
        image: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isBestseller: false,
        isSpecial: false,
        preparationTime: 10,
      },
    ],
  });

  // Category 2: Mains (Curries)
  const mains = await prisma.category.create({
    data: {
      branchId: branch.id,
      name: 'Mains (Curries)',
      description: 'Slow-cooked royal recipes, rich gravies, and classic sub-continental favorites.',
      image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80',
      order: 2,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        branchId: branch.id,
        categoryId: mains.id,
        name: 'Bikaji Butter Chicken',
        description: 'Tandoori chicken shredded and simmered in our signature velvet tomato-butter gravy.',
        price: 495.0,
        offerPrice: 445.0,
        image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isBestseller: true,
        isSpecial: true,
        preparationTime: 15,
      },
      {
        branchId: branch.id,
        categoryId: mains.id,
        name: 'Royal Dal Makhani',
        description: 'Black lentils slow-cooked for 24 hours with tomato puree, fresh cream, and churned butter.',
        price: 395.0,
        image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isBestseller: true,
        isSpecial: false,
        preparationTime: 10,
      },
      {
        branchId: branch.id,
        categoryId: mains.id,
        name: 'Paneer Lababdar',
        description: 'Paneer cubes cooked in a luscious onion-tomato gravy with grated paneer and cream.',
        price: 425.0,
        image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isBestseller: false,
        isSpecial: false,
        preparationTime: 12,
      },
    ],
  });

  // Category 3: Rice & Biryanis
  const biryanis = await prisma.category.create({
    data: {
      branchId: branch.id,
      name: 'Rice & Biryanis',
      description: 'Fragrant basmati rice preparations slow-cooked in traditional clay Handis.',
      image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
      order: 3,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        branchId: branch.id,
        categoryId: biryanis.id,
        name: 'Awadhi Dum Biryani',
        description: 'Long grain basmati rice and marinated chicken slow-cooked on dum with saffron and rose water.',
        price: 525.0,
        offerPrice: 495.0,
        image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isBestseller: true,
        isSpecial: true,
        preparationTime: 18,
      },
      {
        branchId: branch.id,
        categoryId: biryanis.id,
        name: 'Subz Nizami Biryani',
        description: 'Traditional seasonal vegetables layered with saffron rice and slow-cooked in a clay pot.',
        price: 445.0,
        image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isBestseller: false,
        isSpecial: false,
        preparationTime: 15,
      },
      {
        branchId: branch.id,
        categoryId: biryanis.id,
        name: 'Saffron Steamed Rice',
        description: 'Premium aged basmati rice infused with delicate saffron strands and pure ghee.',
        price: 245.0,
        image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isBestseller: false,
        isSpecial: false,
        preparationTime: 8,
      },
    ],
  });

  // Category 4: Desserts & Beverages
  const desserts = await prisma.category.create({
    data: {
      branchId: branch.id,
      name: 'Desserts & Beverages',
      description: 'Sweet completions and refreshing premium coolers.',
      image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
      order: 4,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        branchId: branch.id,
        categoryId: desserts.id,
        name: 'Kesar Pista Rasmalai',
        description: 'Soft cottage cheese patties soaked in thickened milk flavored with saffron, pistachios, and almonds.',
        price: 195.0,
        image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isBestseller: true,
        isSpecial: true,
        preparationTime: 5,
      },
      {
        branchId: branch.id,
        categoryId: desserts.id,
        name: 'Royal Mango Lassi',
        description: 'Chilled yogurt smoothie blended with sweet Alphonso mango pulp and topped with fresh nuts.',
        price: 165.0,
        image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isBestseller: true,
        isSpecial: false,
        preparationTime: 5,
      },
      {
        branchId: branch.id,
        categoryId: desserts.id,
        name: 'Elaichi Gulab Jamun',
        description: 'Fried milk dumplings soaked in warm sugar syrup flavored with green cardamom and rose essence.',
        price: 145.0,
        image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isBestseller: false,
        isSpecial: false,
        preparationTime: 5,
      },
    ],
  });

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
