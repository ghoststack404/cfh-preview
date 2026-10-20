import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'Tecnología', slug: 'tecnologia', description: 'Programación, desarrollo web, ciencia de datos y más', icon: '💻' },
  { name: 'Negocios', slug: 'negocios', description: 'Emprendimiento, marketing, finanzas y gestión', icon: '📊' },
  { name: 'Idiomas', slug: 'idiomas', description: 'Inglés, francés, alemán y más idiomas', icon: '🌍' },
  { name: 'Diseño', slug: 'diseno', description: 'Diseño gráfico, UX/UI, ilustración y fotografía', icon: '🎨' },
  { name: 'Marketing Digital', slug: 'marketing-digital', description: 'SEO, redes sociales, publicidad y growth hacking', icon: '📱' },
  { name: 'Desarrollo Personal', slug: 'desarrollo-personal', description: 'Productividad, liderazgo y habilidades blandas', icon: '🧠' },
  { name: 'Música', slug: 'musica', description: 'Instrumentos, producción musical y teoría', icon: '🎵' },
  { name: 'Salud y Bienestar', slug: 'salud-bienestar', description: 'Nutrición, fitness, meditación y bienestar', icon: '🏋️' },
  { name: 'Ciencias', slug: 'ciencias', description: 'Matemáticas, física, química y biología', icon: '🔬' },
  { name: 'Arte y Creatividad', slug: 'arte-creatividad', description: 'Pintura, escultura, escritura creativa', icon: '🖌️' },
];

async function main() {
  console.log('Seeding categories...');
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, icon: cat.icon, isActive: true },
      create: { name: cat.name, slug: cat.slug, description: cat.description, icon: cat.icon, isActive: true },
    });
    console.log(`  ✓ ${cat.name}`);
  }
  console.log('Done! Categories seeded successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
