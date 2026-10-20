export class CreateCourseDto {
  coachId: string;
  title: string;
  description?: string;
  price: number;
  coverImageUrl?: string;
  categoryId?: string;
}

export class CreateModuleDto {
  title: string;
  description?: string;
  order?: number;
}

export class CreateResourceDto {
  title: string;
  type: 'VIDEO' | 'PDF' | 'LINK' | 'OTHER';
  url: string;
}
