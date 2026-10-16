import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const permissions = [
  'dashboard.view',
  'patients.view',
  'patients.create',
  'patients.edit',
  'patients.delete',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'users.update',
  'users.export',
  'users.reset_password',
  'roles.view',
  'roles.create',
  'roles.update',
  'roles.delete',
  'settings.view',
  'settings.update',
  'appointments.view',
  'appointments.create',
  'appointments.edit',
  'appointments.cancel',
  'queue.view',
  'emr.view',
  'clinical.view',
  'clinical.edit',
  'laboratory.view',
  'laboratory.create',
  'laboratory.collect',
  'laboratory.result',
  'laboratory.verify',
  'laboratory.edit',
  'laboratory.manage_tests',
  'radiology.view',
  'radiology.create',
  'radiology.report',
  'admissions.view',
  'admissions.create',
  'admissions.transfer',
  'admissions.discharge',
  'admissions.manage',
  'nursing.view',
  'nursing.edit',
  'procedures.view',
  'procedures.create',
  'procedures.edit',
  'pharmacy.view',
  'pharmacy.dispense',
  'pharmacy.manage',
  'billing.view',
  'billing.create',
  'billing.payment',
  'billing.refund',
  'insurance.view',
  'insurance.create',
  'insurance.edit',
  'inventory.view',
  'inventory.create',
  'inventory.edit',
  'inventory.delete',
  'inventory.stock',
  'ambulance.view',
  'ambulance.create',
  'ambulance.edit',
  'ambulance.delete',
  'reports.view',
  'audit.view',
  'documents.view',
  'documents.create',
  'documents.delete',
  'doctors.view',
  'doctors.create',
  'doctors.update',
  'doctors.delete',
  'doctors.export',
  'employees.view',
  'employees.create',
  'employees.update',
  'employees.delete',
  'employees.export',
  'audit.export',
  'documents.download',
  'departments.view',
  'departments.manage',
  'support.view',
  'support.ticket.create',
  'support.ticket.manage',
  'support.article.manage',
];
async function main() {
  const created = await Promise.all(
    permissions.map((code) => {
      const [module, action] = code.split('.');
      return prisma.permission.upsert({
        where: { code },
        update: { module: module!, action: action! },
        create: { code, module: module!, action: action! },
      });
    }),
  );
  const hospitalAdminRole = await prisma.role.upsert({
    where: { code: 'HOSPITAL_ADMIN' },
    update: { name: 'Hospital Admin', status: 'ACTIVE', isSystem: true },
    create: {
      code: 'HOSPITAL_ADMIN',
      name: 'Hospital Admin',
      description: 'Full hospital application administration',
      status: 'ACTIVE',
      isSystem: true,
    },
  });
  const staffRoles = await Promise.all(
    [
      ['DOCTOR', 'Doctor'],
      ['NURSE', 'Nurse'],
      ['RECEPTIONIST', 'Receptionist'],
      ['PHARMACIST', 'Pharmacist'],
      ['LAB_TECHNICIAN', 'Lab Technician'],
      ['RADIOLOGY_TECHNICIAN', 'Radiologist'],
      ['BILLING_STAFF', 'Billing Staff'],
      ['INVENTORY_MANAGER', 'Inventory Manager'],
      ['INSURANCE_STAFF', 'Insurance Staff'],
      ['AMBULANCE_COORDINATOR', 'Ambulance Coordinator'],
    ].map(([code, name]) =>
      prisma.role.upsert({
        where: { code: code! },
        update: { name: name!, status: 'ACTIVE', isSystem: true },
        create: { code: code!, name: name!, status: 'ACTIVE', isSystem: true },
      }),
    ),
  );
  await prisma.rolePermission.createMany({
    data: created.map((permission) => ({
      roleId: hospitalAdminRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });
  const permissionByCode = new Map(created.map((permission) => [permission.code, permission.id]));
  await prisma.rolePermission.createMany({data:staffRoles.flatMap(role=>['support.view','support.ticket.create'].map(code=>({roleId:role.id,permissionId:permissionByCode.get(code)!}))),skipDuplicates:true});
  const staffPermissions: Record<string, string[]> = {
    DOCTOR: [
      'dashboard.view',
      'patients.view',
      'appointments.view',
      'appointments.edit',
      'queue.view',
      'emr.view',
      'clinical.view',
      'clinical.edit',
      'documents.view',
      'documents.create',
    ],
    NURSE: [
      'dashboard.view',
      'patients.view',
      'appointments.view',
      'emr.view',
      'clinical.view',
      'admissions.view',
      'nursing.view',
      'nursing.edit',
      'documents.view',
    ],
    RECEPTIONIST: [
      'dashboard.view',
      'patients.view',
      'patients.create',
      'patients.edit',
      'appointments.view',
      'appointments.create',
      'appointments.edit',
      'appointments.cancel',
      'queue.view',
    ],
    PHARMACIST: [
      'dashboard.view',
      'patients.view',
      'pharmacy.view',
      'pharmacy.dispense',
      'billing.view',
    ],
    LAB_TECHNICIAN: [
      'dashboard.view',
      'patients.view',
      'laboratory.view',
      'laboratory.create',
      'laboratory.collect',
      'laboratory.result',
      'laboratory.edit',
      'laboratory.verify',
    ],
    RADIOLOGY_TECHNICIAN: [
      'dashboard.view',
      'patients.view',
      'radiology.view',
      'radiology.create',
      'radiology.report',
      'documents.view',
      'documents.create',
    ],
    BILLING_STAFF: [
      'dashboard.view',
      'patients.view',
      'billing.view',
      'billing.create',
      'billing.payment',
      'billing.refund',
      'insurance.view',
      'insurance.create',
      'insurance.edit',
    ],
    INVENTORY_MANAGER: [
      'dashboard.view',
      'inventory.view',
      'inventory.create',
      'inventory.edit',
      'inventory.delete',
      'inventory.stock',
    ],
    INSURANCE_STAFF: [
      'dashboard.view',
      'patients.view',
      'insurance.view',
      'insurance.create',
      'insurance.edit',
      'billing.view',
    ],
    AMBULANCE_COORDINATOR: [
      'dashboard.view',
      'patients.view',
      'ambulance.view',
      'ambulance.create',
      'ambulance.edit',
      'ambulance.delete',
    ],
  };
  await prisma.rolePermission.createMany({
    data: staffRoles.flatMap((staffRole) =>
      (staffPermissions[staffRole.code] ?? []).map((code) => ({
        roleId: staffRole.id,
        permissionId: permissionByCode.get(code)!,
      })),
    ),
    skipDuplicates: true,
  });
  const email = process.env.SEED_HOSPITAL_ADMIN_EMAIL?.toLowerCase(),
    password = process.env.SEED_HOSPITAL_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      'SEED_HOSPITAL_ADMIN_EMAIL and SEED_HOSPITAL_ADMIN_PASSWORD of at least 12 characters are required.',
    );
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      status: 'ACTIVE',
      deletedAt: null,
      username: 'hospitaladmin',
      passwordHash: await argon2.hash(password),
      firstName: process.env.SEED_HOSPITAL_ADMIN_FIRST_NAME || 'Hospital',
      lastName: process.env.SEED_HOSPITAL_ADMIN_LAST_NAME || 'Admin',
    },
    create: {
      email,
      username: 'hospitaladmin',
      passwordHash: await argon2.hash(password),
      firstName: process.env.SEED_HOSPITAL_ADMIN_FIRST_NAME || 'Hospital',
      lastName: process.env.SEED_HOSPITAL_ADMIN_LAST_NAME || 'Admin',
    },
  });
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: admin.id } }),
    prisma.userRole.create({ data: { userId: admin.id, roleId: hospitalAdminRole.id } }),
  ]);
  await prisma.hospitalSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
  await prisma.applicationSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', timezone: 'Asia/Kolkata', defaultRowsPerPage: 10 },
  });
  await prisma.notificationSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
  await prisma.securitySettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', sessionTimeoutMinutes: 15, passwordMinimumLength: 12 },
  });
  const departments = [];
  for (const item of [
    { code: 'GEN', name: 'General Medicine' },
    { code: 'CAR', name: 'Cardiology' },
    { code: 'NEU', name: 'Neurology' },
    { code: 'ORT', name: 'Orthopedics' },
    { code: 'PED', name: 'Pediatrics' },
    { code: 'EMR', name: 'Emergency' },
  ])
    departments.push(
      await prisma.department.upsert({
        where: { code: item.code },
        update: { name: item.name, status: 'Active' },
        create: item,
      }),
    );
  const doctorRole = staffRoles.find((role) => role.code === 'DOCTOR')!;
  const generalSpecialization = await prisma.specialization.upsert({
    where: { code: 'GEN-MED' },
    update: { name: 'General Medicine', departmentId: departments[0]!.id, status: 'Active' },
    create: { code: 'GEN-MED', name: 'General Medicine', departmentId: departments[0]!.id },
  });
  const doctor = await prisma.user.upsert({
    where: { email: 'doctor@carepoint.test' },
    update: {
      status: 'ACTIVE',
      departmentId: departments[0]?.id,
      specializationId: generalSpecialization.id,
      employeeCode: 'DOC-0001',
      medicalRegistration: 'MCI-CP-0001',
      gender: 'MALE',
      phone: '9876543210',
      qualification: 'MBBS, MD',
      yearsOfExperience: 12,
      consultationFee: 800,
    },
    create: {
      email: 'doctor@carepoint.test',
      username: 'doctor',
      passwordHash: await argon2.hash('DoctorPass123!'),
      firstName: 'Vikram',
      lastName: 'Rao',
      departmentId: departments[0]?.id,
      specializationId: generalSpecialization.id,
      employeeCode: 'DOC-0001',
      medicalRegistration: 'MCI-CP-0001',
      gender: 'MALE',
      phone: '9876543210',
      qualification: 'MBBS, MD',
      yearsOfExperience: 12,
      consultationFee: 800,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: doctor.id, roleId: doctorRole.id } },
    update: {},
    create: { userId: doctor.id, roleId: doctorRole.id },
  });
  const nurseRole = staffRoles.find((role) => role.code === 'NURSE')!;
  const nurse = await prisma.user.upsert({
    where: { email: 'nurse@carepoint.test' },
    update: {
      status: 'ACTIVE',
      departmentId: departments[0]?.id,
      employeeCode: 'NUR-0001',
      designation: 'Staff Nurse',
    },
    create: {
      email: 'nurse@carepoint.test',
      username: 'nurse',
      passwordHash: await argon2.hash('NursePass123!'),
      firstName: 'Priya',
      lastName: 'Menon',
      departmentId: departments[0]?.id,
      employeeCode: 'NUR-0001',
      designation: 'Staff Nurse',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: nurse.id, roleId: nurseRole.id } },
    update: {},
    create: { userId: nurse.id, roleId: nurseRole.id },
  });
  const patient = await prisma.patient.upsert({
    where: { mrn: 'CP-2026-00128' },
    update: { status: 'Active' },
    create: {
      mrn: 'CP-2026-00128',
      firstName: 'Meera',
      lastName: 'Iyer',
      dob: new Date('1989-04-18'),
      gender: 'Female',
      bloodGroup: 'B+',
      phone: '+91 98765 10234',
      email: 'meera@example.com',
      city: 'Bengaluru',
      emergencyContact: '9876510235',
      allergies: ['Penicillin'],
    },
  });
  const ward = await prisma.ward.upsert({
    where: { code: 'MED' },
    update: { name: 'Medical Ward' },
    create: { code: 'MED', name: 'Medical Ward', floor: '1st Floor' },
  });
  const room = await prisma.room.upsert({
    where: { name: '101' },
    update: { wardId: ward.id, ward: 'Medical Ward' },
    create: { name: '101', ward: 'Medical Ward', wardId: ward.id },
  });
  await prisma.bed.upsert({
    where: { roomId_name: { roomId: room.id, name: 'A-101-1' } },
    update: {},
    create: { roomId: room.id, name: 'A-101-1' },
  });
  await prisma.bed.upsert({
    where: { roomId_name: { roomId: room.id, name: 'A-101-2' } },
    update: {},
    create: { roomId: room.id, name: 'A-101-2' },
  });
  await prisma.operationTheatre.upsert({
    where: { code: 'OT-1' },
    update: { name: 'Operation Theatre 1' },
    create: { code: 'OT-1', name: 'Operation Theatre 1' },
  });
  const inventoryCategory = await prisma.inventoryCategory.upsert({
    where: { code: 'CONSUMABLES' },
    update: { name: 'Consumables', isActive: true },
    create: { code: 'CONSUMABLES', name: 'Consumables' },
  });
  const insuranceProvider = await prisma.insuranceProvider.upsert({
    where: { code: 'NHA' },
    update: { name: 'National Health Assurance', isActive: true },
    create: { code: 'NHA', name: 'National Health Assurance' },
  });
  for (const item of [
    { code: 'XRAY', name: 'X-Ray', modality: 'X-Ray' },
    { code: 'CT', name: 'CT Scan', modality: 'CT' },
    { code: 'MRI', name: 'MRI', modality: 'MRI' },
    { code: 'USG', name: 'Ultrasound', modality: 'Ultrasound' },
    { code: 'MAMMO', name: 'Mammography', modality: 'Mammography' },
  ])
    await prisma.radiologyInvestigation.upsert({
      where: { code: item.code },
      update: { ...item, status: 'Active' },
      create: item,
    });
  for (const item of [
    {
      code: 'CBC',
      name: 'Complete Blood Count',
      category: 'Haematology',
      unit: '',
      referenceRange: 'Laboratory-specific',
    },
    {
      code: 'FBS',
      name: 'Fasting Blood Sugar',
      category: 'Biochemistry',
      unit: 'mg/dL',
      referenceRange: '70-100',
    },
    {
      code: 'LFT',
      name: 'Liver Function Test',
      category: 'Biochemistry',
      unit: '',
      referenceRange: 'Laboratory-specific',
    },
    {
      code: 'KFT',
      name: 'Kidney Function Test',
      category: 'Biochemistry',
      unit: '',
      referenceRange: 'Laboratory-specific',
    },
  ])
    await prisma.laboratoryTestDefinition.upsert({
      where: { code: item.code },
      update: { ...item, status: 'Active' },
      create: item,
    });
  const activeAdmission = await prisma.admission.findFirst({
    where: { status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED'] } },
    orderBy: { admittedAt: 'desc' },
  });
  if (activeAdmission) {
    const existingAssignment = await prisma.nurseAssignment.findFirst({
      where: { admissionId: activeAdmission.id, nurseId: nurse.id, endedAt: null },
    });
    if (!existingAssignment)
      await prisma.nurseAssignment.create({
        data: {
          admissionId: activeAdmission.id,
          nurseId: nurse.id,
          assignedById: admin.id,
          shift: 'MORNING',
        },
      });
  }
  console.log(
    JSON.stringify({
      admin: admin.email,
      role: hospitalAdminRole.code,
      permissions: created.length,
      department: departments[0]?.name,
      doctor: doctor.email,
      nurse: nurse.email,
      patient: patient.mrn,
      ward: ward.name,
      inventoryCategory: inventoryCategory.code,
      insuranceProvider: insuranceProvider.code,
    }),
  );
}
main().finally(() => prisma.$disconnect());
