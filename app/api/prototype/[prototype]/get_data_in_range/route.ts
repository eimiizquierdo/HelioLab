// app/api/prototype/[prototype]/get_data_in_range/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getPrototypeData } from "@/lib/prototype-data";

export async function POST(
  req: NextRequest,
  { params }: { params: { prototype: string } }
) {
  const body = await req.json();
  const { start_date, end_date } = body;

  if (!start_date || !end_date) {
    return NextResponse.json(
      { error: "start_date and end_date are required" },
      { status: 400 }
    );
  }

  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json(
      { error: "start_date and end_date must be valid ISO 8601 strings" },
      { status: 400 }
    );
  }

  if (startDate >= endDate) {
    return NextResponse.json(
      { error: "start_date must be before end_date" },
      { status: 400 }
    );
  }

  const prototypeId = (await params).prototype;

  console.log({ prototypeId, startDate, endDate });

  const data = await getPrototypeData(prototypeId, startDate, endDate);
  return NextResponse.json(data, { status: 200 });
}
