import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSession(sessionId: string): Promise<unknown> {
    return this.prisma.session.findUnique({ where: { id: sessionId } });
  }
}
