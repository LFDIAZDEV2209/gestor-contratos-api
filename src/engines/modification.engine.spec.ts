import { efectoModificacion } from './modification.engine';

const base = {
  id: 'CT-1', numero: '044-2026', estado: 'Activo', anulado: false,
  fechaFin: '2026-10-06', valorBase: 35_450_430_276, iva: 6_735_581_752, otrosImp: 0,
  adiciones: 0, reducciones: 0, contratista: 'UT Red Salud Norte', supervisor: 'Sup 1',
};

describe('Efectos de modificaciones (files/05 §7)', () => {
  it('Adición: suma a adiciones la diferencia entre valor nuevo y actual', () => {
    const r = efectoModificacion(base, { tipo: 'Adición', valorNuevo: 42_186_012_028 });
    expect(r.cambios.adiciones).toBe(42_186_012_028 - 42_186_012_028 + 0);
    // valorActual = 42 186 012 028 (base+iva), valorNuevo igual ⇒ delta 0
    expect(r.cambios.adiciones).toBe(0);
    expect(r.avisoRevisarPolizas).toBe(true);
  });

  it('Adición con valor mayor suma el delta al campo adiciones', () => {
    const r = efectoModificacion(base, { tipo: 'Adición', valorNuevo: 43_000_000_000 });
    expect(r.cambios.adiciones).toBe(43_000_000_000 - 42_186_012_028);
  });

  it('Reducción: suma a reducciones la diferencia entre valor actual y nuevo', () => {
    const r = efectoModificacion(base, { tipo: 'Reducción', valorNuevo: 41_000_000_000 });
    expect(r.cambios.reducciones).toBe(42_186_012_028 - 41_000_000_000);
  });

  it('Prórroga: cambia fechaFin; si estaba Terminado vuelve a Activo', () => {
    const r = efectoModificacion(base, { tipo: 'Prórroga', fechaNueva: '2027-02-03' });
    expect(r.cambios.fechaFin).toBe('2027-02-03');
    expect(r.cambios.estado).toBeUndefined();
    expect(r.avisoRevisarPolizas).toBe(true);

    const r2 = efectoModificacion({ ...base, estado: 'Terminado' }, { tipo: 'Prórroga', fechaNueva: '2027-02-03' });
    expect(r2.cambios.estado).toBe('Activo');
  });

  it('Suspensión y Reinicio cambian el estado', () => {
    expect(efectoModificacion(base, { tipo: 'Suspensión' }).cambios.estado).toBe('Suspendido');
    const r = efectoModificacion(base, { tipo: 'Reinicio', fechaNueva: '2027-03-01' });
    expect(r.cambios.estado).toBe('Activo');
    expect(r.cambios.fechaFin).toBe('2027-03-01');
    expect(r.avisoRevisarPolizas).toBe(true);
  });

  it('Cesión: cambia contratista y guarda el anterior en el impacto', () => {
    const r = efectoModificacion(base, { tipo: 'Cesión', nuevoTexto: 'Nueva UT Salud' });
    expect(r.cambios.contratista).toBe('Nueva UT Salud');
    expect(r.impactoAutomatico).toBe('Cesión de UT Red Salud Norte a Nueva UT Salud');
  });

  it('Modificación de supervisor cambia el supervisor', () => {
    expect(efectoModificacion(base, { tipo: 'Modificación de supervisor', nuevoTexto: 'Sup 2' }).cambios.supervisor).toBe('Sup 2');
  });

  it('Terminación anticipada: cambia fechaFin y estado a Terminado', () => {
    const r = efectoModificacion(base, { tipo: 'Terminación anticipada', fechaNueva: '2026-09-30' });
    expect(r.cambios.estado).toBe('Terminado');
    expect(r.cambios.fechaFin).toBe('2026-09-30');
  });

  it('Modificación de obligaciones/condiciones: solo queda registrada', () => {
    const r = efectoModificacion(base, { tipo: 'Modificación de condiciones' });
    expect(Object.keys(r.cambios)).toHaveLength(0);
    expect(r.avisoRevisarPolizas).toBe(false);
  });
});
