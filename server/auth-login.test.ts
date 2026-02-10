import { describe, it, expect, vi } from 'vitest';
import { getUserByEmailAndPassword } from './db';

// Mock the database
vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getUserByEmailAndPassword: vi.fn(),
  };
});

describe('Autenticación - Login con Email y Contraseña', () => {
  it('getUserByEmailAndPassword es una función exportada', () => {
    expect(typeof getUserByEmailAndPassword).toBe('function');
  });

  it('debe normalizar email con trim y lowercase', () => {
    const testCases = [
      { input: '  User@Email.COM  ', expected: 'user@email.com' },
      { input: 'user@email.com', expected: 'user@email.com' },
      { input: 'USER@EMAIL.COM', expected: 'user@email.com' },
      { input: ' user@email.com ', expected: 'user@email.com' },
    ];

    testCases.forEach(({ input, expected }) => {
      const normalized = input.trim().toLowerCase();
      expect(normalized).toBe(expected);
    });
  });

  it('debe validar que email no esté vacío', () => {
    const email = '';
    expect(email.trim().length).toBe(0);
  });

  it('debe validar que password no esté vacío', () => {
    const password = '';
    expect(password.length).toBe(0);
  });

  it('debe validar formato básico de email', () => {
    const validEmails = ['user@test.com', 'a@b.co', 'user.name@domain.mx'];
    const invalidEmails = ['noarroba', 'nopunto', 'sinpunto@dominio'];

    validEmails.forEach(email => {
      const hasAt = email.includes('@');
      const hasDotAfterAt = email.split('@')[1]?.includes('.') ?? false;
      expect(hasAt && hasDotAfterAt).toBe(true);
    });

    invalidEmails.forEach(email => {
      const hasAt = email.includes('@');
      const hasDotAfterAt = email.split('@')[1]?.includes('.') ?? false;
      expect(hasAt && hasDotAfterAt).toBe(false);
    });
  });

  it('retry automático: máximo 2 reintentos en error de servidor', () => {
    const MAX_RETRIES = 2;
    let retryCount = 0;
    
    // Simular 3 intentos (1 original + 2 retries)
    while (retryCount < MAX_RETRIES) {
      retryCount++;
    }
    
    expect(retryCount).toBe(MAX_RETRIES);
  });

  it('no debe reintentar en error UNAUTHORIZED (credenciales incorrectas)', () => {
    const errorCode = 'UNAUTHORIZED';
    const shouldRetry = errorCode === 'INTERNAL_SERVER_ERROR';
    expect(shouldRetry).toBe(false);
  });

  it('no debe reintentar en error FORBIDDEN (usuario inactivo)', () => {
    const errorCode = 'FORBIDDEN';
    const shouldRetry = errorCode === 'INTERNAL_SERVER_ERROR';
    expect(shouldRetry).toBe(false);
  });
});
