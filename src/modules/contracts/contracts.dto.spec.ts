import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CrearContratoDto,
  ActualizarContratoDto,
  ValidarContratoDto,
  RectificarExtraidosDto,
} from './contracts.dto';

describe('Contracts DTOs (class-validator)', () => {
  const contratoValido = {
    numero: 'CT-2026-001',
    tipo: 'Obra civil',
    companyId: 'EMP-01',
    contratista: 'Constructora S.A.',
    nitContratista: '900.123.456-1',
    objeto: 'Pavimentación de vía principal',
    responsable: 'Carlos Gómez',
    supervisor: 'María Rodríguez',
    fechaInicio: '2026-01-15',
    fechaFin: '2026-12-15',
    valorBase: 500_000_000,
    avanceFisico: 45,
  };

  describe('CrearContratoDto', () => {
    it('valida exitosamente un DTO con todos los campos obligatorios correctos', async () => {
      const dto = plainToInstance(CrearContratoDto, contratoValido);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('falla si faltan campos obligatorios como numero, tipo, companyId, etc.', async () => {
      const dto = plainToInstance(CrearContratoDto, {});
      const errors = await validate(dto);

      const camposConError = errors.map((e) => e.property);
      expect(camposConError).toContain('numero');
      expect(camposConError).toContain('tipo');
      expect(camposConError).toContain('companyId');
      expect(camposConError).toContain('contratista');
      expect(camposConError).toContain('nitContratista');
      expect(camposConError).toContain('objeto');
      expect(camposConError).toContain('responsable');
      expect(camposConError).toContain('supervisor');
      expect(camposConError).toContain('fechaInicio');
      expect(camposConError).toContain('fechaFin');
      expect(camposConError).toContain('valorBase');
    });

    it('falla si fechaInicio o fechaFin no tienen formato de fecha válido', async () => {
      const dto = plainToInstance(CrearContratoDto, {
        ...contratoValido,
        fechaInicio: 'no-es-fecha',
        fechaFin: '2026/15/99',
      });
      const errors = await validate(dto);

      const camposConError = errors.map((e) => e.property);
      expect(camposConError).toContain('fechaInicio');
      expect(camposConError).toContain('fechaFin');
    });

    it('falla si valorBase es negativo', async () => {
      const dto = plainToInstance(CrearContratoDto, {
        ...contratoValido,
        valorBase: -100,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'valorBase')).toBe(true);
    });

    it('falla si avanceFisico es menor a 0 o mayor a 100', async () => {
      const dtoMayor = plainToInstance(CrearContratoDto, {
        ...contratoValido,
        avanceFisico: 101,
      });
      const errorsMayor = await validate(dtoMayor);
      expect(errorsMayor.some((e) => e.property === 'avanceFisico')).toBe(true);

      const dtoMenor = plainToInstance(CrearContratoDto, {
        ...contratoValido,
        avanceFisico: -1,
      });
      const errorsMenor = await validate(dtoMenor);
      expect(errorsMenor.some((e) => e.property === 'avanceFisico')).toBe(true);
    });
  });

  describe('ActualizarContratoDto', () => {
    it('valida exitosamente con campos válidos y version >= 1', async () => {
      const dto = plainToInstance(ActualizarContratoDto, {
        ...contratoValido,
        version: 1,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('falla si version está ausente o es menor a 1', async () => {
      const dtoSinVersion = plainToInstance(ActualizarContratoDto, {
        ...contratoValido,
      });
      const errorsSin = await validate(dtoSinVersion);
      expect(errorsSin.some((e) => e.property === 'version')).toBe(true);

      const dtoVersionCero = plainToInstance(ActualizarContratoDto, {
        ...contratoValido,
        version: 0,
      });
      const errorsCero = await validate(dtoVersionCero);
      expect(errorsCero.some((e) => e.property === 'version')).toBe(true);
    });
  });

  describe('ValidarContratoDto', () => {
    it('acepta force como booleano opcional', async () => {
      const dtoVacio = plainToInstance(ValidarContratoDto, {});
      expect(await validate(dtoVacio)).toHaveLength(0);

      const dtoForce = plainToInstance(ValidarContratoDto, { force: true });
      expect(await validate(dtoForce)).toHaveLength(0);

      const dtoInvalido = plainToInstance(ValidarContratoDto, { force: 'no-es-boolean' });
      const errors = await validate(dtoInvalido);
      expect(errors.some((e) => e.property === 'force')).toBe(true);
    });
  });
});
