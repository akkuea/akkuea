import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Role {
  id: string;
  label: string;
}

interface RoleSelectorProps {
  roles: Role[];
  selectedRoles: string[];
  onRoleChange: (roleId: string) => void;
}

export const RoleSelector = ({ roles, selectedRoles, onRoleChange }: RoleSelectorProps) => {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">Roles</label>
      <div className="flex flex-wrap gap-4">
        {roles.map((role) => (
          <div key={role.id} className="flex items-center space-x-2">
            <Checkbox
              id={role.id}
              checked={selectedRoles.includes(role.id)}
              onCheckedChange={() => onRoleChange(role.id)}
              className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label htmlFor={role.id}>{role.label}</Label>
          </div>
        ))}
      </div>
    </div>
  );
};
