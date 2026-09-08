import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectStatus } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const projects = await this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { reports: true },
        },
      },
    });

    return projects.map((p) => ({
      ...p,
      reportCount: p._count.reports,
    }));
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: { reports: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return {
      ...project,
      reportCount: project._count.reports,
    };
  }

  async create(dto: CreateProjectDto) {
    const existing = await this.prisma.project.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`Project code '${dto.code}' is already in use`);
    }

    return this.prisma.project.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description || null,
        status: ProjectStatus.ACTIVE,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.project.findUnique({
        where: { code: dto.code.toUpperCase() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Project code '${dto.code}' is already in use`);
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.code && { code: dto.code.toUpperCase() }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft archive or delete
    return this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.ARCHIVED },
    });
  }
}
