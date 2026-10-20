import { Controller, Post, Body, Param, Put, Patch, Get } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto, CreateModuleDto, CreateResourceDto } from './dto/create-course.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  create(@Body() createCourseDto: any) {
    console.log('Received course creation request:', createCourseDto);
    return this.coursesService.create(createCourseDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.getCourseWithDetails(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateCourseDto: Partial<CreateCourseDto>) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Post(':id/modules')
  addModule(@Param('id') id: string, @Body() createModuleDto: CreateModuleDto) {
    return this.coursesService.addModule(id, createModuleDto);
  }

  @Post('modules/:moduleId/resources')
  addResource(@Param('moduleId') moduleId: string, @Body() createResourceDto: CreateResourceDto) {
    return this.coursesService.addResource(moduleId, createResourceDto);
  }

  @Patch(':id/publish')
  publishCourse(@Param('id') id: string) {
    return this.coursesService.publishCourse(id);
  }
}
