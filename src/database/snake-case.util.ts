/** Utilidades de conversión de nombres (camelCase → snake_case). */
export const SnakeCaseNamingStrategy = {
  camelToSnake(texto: string): string {
    return texto
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
  },
};
