import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ items: [] }); // Or handle guest cart if needed later

    let cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                priceCents: true,
                currency: true,
                thumbnailUrl: true,
                coach: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: user.id },
        include: {
          items: {
            include: {
              course: {
                select: { id: true, title: true, priceCents: true, currency: true, thumbnailUrl: true, coach: { select: { name: true } } }
              }
            }
          }
        }
      });
    }

    return NextResponse.json({ items: cart?.items || [] });
  } catch (error) {
    console.warn("GET Cart fallback (db offline or empty):", error);
    return NextResponse.json({ items: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json();
    const { courseId, courseData } = body;

    if (!courseId) {
      return NextResponse.json({ error: "Falta courseId" }, { status: 400 });
    }

    let cart = await prisma.cart.findUnique({ where: { userId: user.id } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId: user.id } });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }
    
    if (course.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Este curso aún no está publicado y no se puede comprar." }, { status: 400 });
    }
    
    if (course.coachId === user.id) {
      return NextResponse.json({ error: "Eres el creador de este curso, ya tienes acceso." }, { status: 400 });
    }
    
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        courseId: course.id,
        studentId: user.id,
        status: { in: ["ACTIVE", "COMPLETED"] }
      }
    });
    
    if (existingEnrollment) {
      return NextResponse.json({ error: "Ya estás inscrito en este curso." }, { status: 400 });
    }

    const item = await prisma.cartItem.upsert({
      where: {
        cartId_courseId: {
          cartId: cart.id,
          courseId: course.id,
        }
      },
      update: {},
      create: {
        cartId: cart.id,
        courseId: course.id,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            priceCents: true,
            currency: true,
            thumbnailUrl: true,
            coach: { select: { name: true } }
          }
        }
      }
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("POST Cart Error", error);
    return NextResponse.json({ error: "Error al añadir al carrito" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json();
    const itemsList: Array<{ courseId?: string; id?: string; course?: any; courseData?: any }> = Array.isArray(body?.items) ? body.items : [];

    let cart = await prisma.cart.findUnique({ where: { userId: user.id } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId: user.id } });
    }

    // Limpiar ítems previos para reemplazo atómico
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    // Re-insertar la nueva lista de ítems
    for (const it of itemsList) {
      const cId = it.courseId || it.course?.id;
      if (!cId) continue;
      const course = await prisma.course.findUnique({ where: { id: cId } });
      if (course) {
        await prisma.cartItem.upsert({
          where: {
            cartId_courseId: {
              cartId: cart.id,
              courseId: course.id,
            }
          },
          update: {},
          create: {
            cartId: cart.id,
            courseId: course.id,
          }
        });
      }
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                priceCents: true,
                currency: true,
                thumbnailUrl: true,
                coach: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    return NextResponse.json({ success: true, items: updatedCart?.items || [] });
  } catch (error) {
    console.error("PUT Cart Error", error);
    return NextResponse.json({ error: "Error al actualizar carrito" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const itemId = req.nextUrl.searchParams.get("itemId");
    if (!itemId) return NextResponse.json({ error: "Falta itemId" }, { status: 400 });

    const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
    if (!cart) return NextResponse.json({ error: "No tienes carrito" }, { status: 404 });

    await prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        OR: [
          { id: itemId },
          { courseId: itemId }
        ]
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Cart Error", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
