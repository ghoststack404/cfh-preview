import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, CreateModuleDto, CreateResourceDto } from './dto/create-course.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async create(createCourseDto: any) {
    let fullDescription = createCourseDto.description || '';
    if (createCourseDto.whatYouWillLearn && createCourseDto.whatYouWillLearn.length > 0) {
      const learnList = createCourseDto.whatYouWillLearn.map((item: string) => `- ${item}`).join('\n');
      fullDescription += `\n\n### Lo que aprenderás\n${learnList}`;
    }

    return this.prisma.course.create({
      data: {
        title: createCourseDto.title,
        slug: createCourseDto.title.toLowerCase().replace(/ /g, '-') + '-' + Date.now(),
        summary: createCourseDto.summary || createCourseDto.description?.substring(0, 100) || '',
        description: fullDescription,
        thumbnailUrl: createCourseDto.coverImageUrl || null,
        introVideoUrl: createCourseDto.introVideoUrl || null,
        priceCents: Math.round((createCourseDto.price || 0) * 100),
        coachId: createCourseDto.coachId,
        ...(createCourseDto.categoryId && { categoryId: createCourseDto.categoryId }),
      }
    });
  }

  async update(id: string, updateData: any) {
    const dataToUpdate: any = {};

    if (updateData.title !== undefined) dataToUpdate.title = updateData.title;
    if (updateData.description !== undefined) dataToUpdate.description = updateData.description;
    if (updateData.summary !== undefined) dataToUpdate.summary = updateData.summary;
    if (updateData.coverImageUrl !== undefined) dataToUpdate.thumbnailUrl = updateData.coverImageUrl;
    if (updateData.introVideoUrl !== undefined) dataToUpdate.introVideoUrl = updateData.introVideoUrl;
    if (updateData.price !== undefined) dataToUpdate.priceCents = Math.round(updateData.price * 100);

    if (Object.keys(dataToUpdate).length === 0) {
      return this.prisma.course.findUnique({ where: { id } });
    }

    return this.prisma.course.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async addModule(courseId: string, createModuleDto: CreateModuleDto) {
    const existing = await this.prisma.courseModule.count({ where: { courseId } });
    return this.prisma.courseModule.create({
      data: {
        title: createModuleDto.title,
        courseId,
        position: createModuleDto.order || existing + 1,
      },
    });
  }

  async addResource(moduleId: string, createResourceDto: CreateResourceDto) {
    const existing = await this.prisma.courseLesson.count({ where: { moduleId } });
    return this.prisma.courseLesson.create({
      data: {
        title: createResourceDto.title,
        moduleId,
        position: existing + 1,
        videoUrl: createResourceDto.url,
      },
    });
  }

  async publishCourse(id: string) {
    return this.prisma.course.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
  }

  async getCourseWithDetails(id: string) {
    return this.prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            lessons: true,
          },
          orderBy: {
            position: 'asc'
          }
        },
      },
    });
  }
}
