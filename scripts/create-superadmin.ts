import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { getMongoUriForHostScripts, maskMongoUri } from './mongo-uri-for-host';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Error: falta la variable de entorno ${name}.`);
    console.error(
      '  Variables requeridas: SUPERADMIN_BOOTSTRAP_TOKEN, SUPERADMIN_USUARIO, SUPERADMIN_PASSWORD',
    );
    process.exit(1);
  }
  return value;
}

function assertPasswordStrength(password: string): void {
  if (password.length < 8) {
    console.error(
      'Error: SUPERADMIN_PASSWORD debe tener al menos 8 caracteres.',
    );
    process.exit(1);
  }
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    console.error(
      'Error: SUPERADMIN_PASSWORD debe incluir mayúscula, minúscula y número.',
    );
    process.exit(1);
  }
}

function requireBootstrapToken(): void {
  const token = requireEnv('SUPERADMIN_BOOTSTRAP_TOKEN');
  if (token.length < 32) {
    console.error(
      'Error: SUPERADMIN_BOOTSTRAP_TOKEN debe tener al menos 32 caracteres.',
    );
    console.error('  Genera uno con: openssl rand -base64 32');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  requireBootstrapToken();
  const usuario = requireEnv('SUPERADMIN_USUARIO');
  const password = requireEnv('SUPERADMIN_PASSWORD');
  assertPasswordStrength(password);

  const mongoUri = getMongoUriForHostScripts();
  console.log(`Conectando a ${maskMongoUri(mongoUri)}...`);
  await mongoose.connect(mongoUri);

  const UserModel = mongoose.connection.collection('usuarios');
  const passwordHash = await bcrypt.hash(password, 10);

  const existente = await UserModel.findOne({ usuario });

  if (existente) {
    await UserModel.updateOne(
      { usuario },
      {
        $set: {
          isSuperAdmin: true,
          passwordHash,
          buildingId: null,
          rol: 'admin',
        },
      },
    );
    console.log(`✅ SuperAdmin actualizado: "${usuario}"`);
  } else {
    await UserModel.insertOne({
      usuario,
      passwordHash,
      rol: 'admin',
      isSuperAdmin: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✅ SuperAdmin creado: "${usuario}"`);
  }

  console.log(
    '   Inicia sesión en /admin/login — serás redirigido a /super/edificios',
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
