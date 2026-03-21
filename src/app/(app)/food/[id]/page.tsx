export default async function FoodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold">Food Details</h1>
      <p className="text-muted-foreground mt-2">Food ID: {id}</p>
    </div>
  );
}
