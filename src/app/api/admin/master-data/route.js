import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth/index.js';
import { prisma } from '../../../../lib/prisma.js';
import {
  adminEntities,
  buildRecordPayload,
  getAdminEntity,
  getAdminEntityKeys,
  serializeRecord,
} from '../../../../lib/admin-master-data.js';

function jsonResponse(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

function getEntityFromRequest(request) {
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get('entity');
  const config = getAdminEntity(entity);

  if (!entity || !config) {
    return {
      error: jsonResponse(
        {
          success: false,
          error: 'ไม่พบชนิดข้อมูลที่ต้องการจัดการ',
          availableEntities: getAdminEntityKeys(),
        },
        400,
      ),
    };
  }

  return { config };
}

function buildWhere(config, id) {
  return { [config.idField]: id };
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function createPrismaErrorMessage(error) {
  if (error?.code === 'P2002') return 'ข้อมูลซ้ำกับรายการที่มีอยู่แล้ว กรุณาตรวจรหัสหรือความสัมพันธ์ที่กำหนด';
  if (error?.code === 'P2003') return 'ข้อมูลอ้างอิงไม่ถูกต้อง กรุณาเลือกหลักสูตรหรือรายวิชาที่มีอยู่จริง';
  if (error?.code === 'P2025') return 'ไม่พบรายการที่ต้องการแก้ไขหรือลบ';
  return 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
}

async function validateEntityData(config, data) {
  if (config.model !== 'rule') return [];

  const program = await prisma.program.findUnique({
    where: { program_id: data.program_id },
    select: { program_code: true },
  });

  if (!program) return ['ไม่พบหลักสูตรที่เลือก'];
  if (program.program_code !== 'CS2565') return ['Demo รอบนี้อนุญาตให้จัดการ Rule ของ CS2565 เท่านั้น'];
  return [];
}

function createLookupSelect(config) {
  const selectedFields = config.fields
    .filter((field) => ['text', 'number', 'select'].includes(field.type))
    .slice(0, 4)
    .map((field) => [field.name, true]);

  return Object.fromEntries([[config.idField, true], ...selectedFields]);
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { config, error } = getEntityFromRequest(request);
  if (error) return error;

  try {
    const records = await prisma[config.model].findMany({
      orderBy: config.orderBy,
      include: config.include,
    });

    const lookups = {};
    for (const key of getAdminEntityKeys()) {
      const lookupConfig = adminEntities[key];
      lookups[key] = await prisma[lookupConfig.model].findMany({
        orderBy: lookupConfig.orderBy,
        select: createLookupSelect(lookupConfig),
      });
    }

    return jsonResponse({
      success: true,
      data: serializeRecord(records),
      lookups: serializeRecord(lookups),
      config,
    });
  } catch (caughtError) {
    return jsonResponse({ success: false, error: createPrismaErrorMessage(caughtError) }, 500);
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { config, error } = getEntityFromRequest(request);
  if (error) return error;

  const payload = await readBody(request);
  const { data, errors } = buildRecordPayload(config, payload);
  if (errors.length > 0) return jsonResponse({ success: false, errors }, 422);

  try {
    const entityErrors = await validateEntityData(config, data);
    if (entityErrors.length > 0) return jsonResponse({ success: false, errors: entityErrors }, 422);

    const record = await prisma[config.model].create({ data });
    return jsonResponse({ success: true, data: serializeRecord(record) }, 201);
  } catch (caughtError) {
    return jsonResponse({ success: false, error: createPrismaErrorMessage(caughtError) }, 400);
  }
}

export async function PUT(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { config, error } = getEntityFromRequest(request);
  if (error) return error;

  const payload = await readBody(request);
  const id = payload[config.idField];
  if (!id) return jsonResponse({ success: false, error: 'ต้องระบุรหัสรายการที่ต้องการแก้ไข' }, 400);

  const { data, errors } = buildRecordPayload(config, payload);
  if (errors.length > 0) return jsonResponse({ success: false, errors }, 422);

  try {
    const entityErrors = await validateEntityData(config, data);
    if (entityErrors.length > 0) return jsonResponse({ success: false, errors: entityErrors }, 422);

    const record = await prisma[config.model].update({
      where: buildWhere(config, id),
      data,
    });
    return jsonResponse({ success: true, data: serializeRecord(record) });
  } catch (caughtError) {
    return jsonResponse({ success: false, error: createPrismaErrorMessage(caughtError) }, 400);
  }
}

export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { config, error } = getEntityFromRequest(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return jsonResponse({ success: false, error: 'ต้องระบุรหัสรายการที่ต้องการลบ' }, 400);

  try {
    await prisma[config.model].delete({ where: buildWhere(config, id) });
    return jsonResponse({ success: true });
  } catch (caughtError) {
    return jsonResponse({ success: false, error: createPrismaErrorMessage(caughtError) }, 400);
  }
}
