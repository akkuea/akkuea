"use client";

import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { PropertyViewer3DDynamic } from "@/components/property/PropertyViewer3D.dynamic";

interface PropertyEvidencePanelProps {
  /** Gaussian splat capture of the ally's property, when one exists. */
  splatUrl: string | null;
  propertyName: string;
}

/**
 * The property as a second, independent evidence channel.
 *
 * The hashed income statement says what the ally reported. This says the
 * property is real and looks the way it was described, which an investor can
 * judge without trusting either Akkuea or the ally.
 *
 * The pilot ally may not have a capture yet, so an absent splat renders an
 * explicit empty state rather than blocking the rest of the page.
 */
export function PropertyEvidencePanel({
  splatUrl,
  propertyName,
}: PropertyEvidencePanelProps) {
  const t = useTranslations("Pilot");

  return (
    <Card variant="bordered">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">
          {t("property.title")}
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          {t("property.subtitle")}
        </p>
      </div>

      {splatUrl ? (
        <PropertyViewer3DDynamic
          splatUrl={splatUrl}
          propertyName={propertyName}
        />
      ) : (
        <EmptyState
          title={t("property.emptyTitle")}
          description={t("property.emptyDescription")}
          icon={
            <Building2
              className="h-5 w-5 text-neutral-500"
              aria-hidden="true"
            />
          }
        />
      )}
    </Card>
  );
}
