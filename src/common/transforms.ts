import { ValueTransformer } from 'typeorm';

/**
 * Dinero en COP: enteros sin decimales (files/02). PostgreSQL usa bigint;
 * node-postgres devuelve bigint como texto → se convierte a number (valores < 9e15).
 */
export const Dinero: ValueTransformer = {
  to: (v: unknown): unknown => (v == null ? null : Math.round(Number(v))),
  from: (v: unknown): unknown => (v == null || v === '' ? null : Number(v)),
};

/** Porcentajes con hasta 2 decimales (numeric(5,2) → number). */
export const Porcentaje: ValueTransformer = {
  to: (v: unknown): unknown => (v == null ? null : Math.round(Number(v) * 100) / 100),
  from: (v: unknown): unknown => (v == null || v === '' ? null : Number(v)),
};
