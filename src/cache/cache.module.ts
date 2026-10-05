import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_SERVICE } from './cache.service';
import { MemoryCacheService } from './memory-cache.service';
import { ValkeyCacheService } from './valkey-cache.service';

@Global()
@Module({
  providers: [
    MemoryCacheService,
    {
      provide: CACHE_SERVICE,
      inject: [ConfigService, MemoryCacheService],
      useFactory: (config: ConfigService, memory: MemoryCacheService) => {
        const driver = config.get<string>('cache.driver');
        const host = config.get<string>('cache.host');
        if (driver === 'memory' || !host) return memory;
        return new ValkeyCacheService({
          host,
          port: config.get<number>('cache.port') ?? 6379,
          password: config.get<string>('cache.password'),
          tls: config.get<boolean>('cache.tls') ?? false,
          defaultTtl: config.get<number>('cache.defaultTtl') ?? 300,
          nodeEnv: config.get<string>('nodeEnv') ?? 'development',
        });
      },
    },
  ],
  exports: [CACHE_SERVICE],
})
export class CacheModule {}
