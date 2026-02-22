import {
  BadGatewayException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { AppConfig } from './configuration';

@Controller('config')
export class GameConfigProxyController {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  @UseGuards(JwtAuthGuard)
  @Get('game')
  async getGameConfig(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.forwardJson(request, response, 'GET', '/config/game');
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('game')
  async updateGameConfig(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.forwardJson(request, response, 'PUT', '/config/game', body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('game/merchants')
  async listMerchantConfigs(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.forwardJson(request, response, 'GET', '/config/game/merchants');
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('game/merchant/:merchantId')
  async deleteMerchantConfig(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('merchantId') merchantId: string,
  ) {
    return this.forwardJson(
      request,
      response,
      'DELETE',
      `/config/game/merchant/${encodeURIComponent(merchantId)}`,
    );
  }

  private async forwardJson(
    request: Request,
    response: Response,
    method: 'GET' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ) {
    const routing = this.configService.getOrThrow<AppConfig['routing']>(
      'routing',
      {
        infer: true,
      },
    );
    const baseUrl = routing.gameServerUrl;
    const upstreamUrl = new URL(path + this.extractQueryString(request), baseUrl)
      .toString();

    const headers: Record<string, string> = {};
    if (typeof request.headers.authorization === 'string') {
      headers.authorization = request.headers.authorization;
    }
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    let upstreamResponse: globalThis.Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: method,
        headers: headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new BadGatewayException(
        `Failed to contact game config service: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    response.status(upstreamResponse.status);

    const contentType = upstreamResponse.headers.get('content-type') ?? '';
    const raw = await upstreamResponse.text();
    if (!raw) return null;
    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(raw);
      } catch {
        return {
          message: raw,
        };
      }
    }
    return {
      message: raw,
    };
  }

  private extractQueryString(request: Request) {
    const queryIndex = request.originalUrl.indexOf('?');
    if (queryIndex < 0) {
      return '';
    }
    return request.originalUrl.slice(queryIndex);
  }
}
