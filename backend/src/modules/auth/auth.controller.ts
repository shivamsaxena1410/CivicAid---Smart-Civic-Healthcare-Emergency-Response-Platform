import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  // Tighter than the global 120/min bucket. Account creation is the cheapest
  // way to fill the user table and to enumerate which emails are already taken
  // via the 409, so it gets the strictest limit of the three.
  @Throttle({ default: { ttl: 300_000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new citizen or organization user account' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User account created successfully.' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email address already in use.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  // Credential stuffing is the reason this endpoint is limited at all; 10/min
  // per IP still leaves room for a person mistyping a password several times.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Login successful, returns JWT tokens.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  // Refresh is legitimate but bounded: the client refreshes once per access
  // token expiry and de-duplicates concurrent attempts, so a caller hitting
  // this 30 times a minute is either looping or guessing token values.
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using a valid refresh token' })
  @ApiResponse({ status: HttpStatus.OK, description: 'New access token issued.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Refresh token expired or invalid.' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile and organizations' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User profile retrieved.' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidate user sessions' })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id);
  }
}
