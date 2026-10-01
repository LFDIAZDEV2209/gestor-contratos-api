import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from '../users/users.dto';
import { CurrentUser, Public, UsuarioInfo } from '../../common/decorators';
import { contextoDe, ReqContext } from '../../common/req-context';
import { Request } from 'express';
import { RolesService } from '../roles/roles.service';
import { Permiso } from '../../common/decorators';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly roles: RolesService,
  ) {}

  @Post('auth/login')
  @Public()
  @ApiOperation({ summary: 'Login de demostración (correo de un usuario sembrado) → JWT' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ctx: ReqContext = contextoDe(req, { id: '(anónimo)', nombre: 'anónimo', email: dto.email, rol: '-' });
    return this.auth.login(dto.email, ctx);
  }

  @Get('me')
  @ApiOperation({ summary: 'Usuario autenticado, rol y permisos efectivos' })
  async me(@CurrentUser() user: UsuarioInfo): Promise<{ usuario: UsuarioInfo; rol: string; permisos: Permiso[] }> {
    const permisos = await this.roles.permisosDeRol(user.rol);
    return { usuario: user, rol: user.rol, permisos: [...permisos] };
  }
}
