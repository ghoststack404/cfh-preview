import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('coaches')
  async searchCoaches(
    @Query('query') query?: string,
    @Query('specialty') specialty?: string,
    @Query('language') language?: string,
    @Query('maxPrice') maxPrice?: string,
  ): Promise<any> {
    return this.searchService.searchCoaches({
      query,
      specialty,
      language,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    });
  }
}
