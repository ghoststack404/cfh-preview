import { notFound } from "next/navigation";
import { getCourseForEditor, getCategories } from "@/app/actions/course-builder";
import { requirePageUser } from "@/lib/auth";
import CourseEditorClient from "./CourseEditorClient";

export default async function EditCoursePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePageUser();
  if (!user) notFound();

  const [course, categories] = await Promise.all([
    getCourseForEditor(id).catch(() => null),
    getCategories(),
  ]);

  if (!course) notFound();

  return (
    <CourseEditorClient
      course={course as any}
      categories={categories}
      locale={locale}
    />
  );
}
