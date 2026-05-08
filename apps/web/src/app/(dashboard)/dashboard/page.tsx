import { T } from "gt-next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>
            <T>Customers</T>
          </CardTitle>
          <CardDescription>
            <T>People who can redeem vouchers and earn loyalty points.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <T>Phase 2 ships customer CRUD and segments.</T>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <T>Segments</T>
          </CardTitle>
          <CardDescription>
            <T>JSON Logic rules over customer attributes.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <T>Build a segment to target promotions.</T>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <T>Promotions</T>
          </CardTitle>
          <CardDescription>
            <T>Campaigns, vouchers, gift cards, loyalty.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <T>Coming in Phase 3.</T>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
