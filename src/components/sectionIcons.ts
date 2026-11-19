import {
  Award,
  Briefcase,
  FileText,
  FolderKanban,
  GraduationCap,
  Plus,
  Wrench,
} from 'lucide-vue-next'

export function sectionIcon(type: string) {
  switch (type) {
    case 'summary':
      return FileText
    case 'experience':
      return Briefcase
    case 'projects':
      return FolderKanban
    case 'education':
      return GraduationCap
    case 'skills':
      return Wrench
    case 'awards':
      return Award
    default:
      return Plus
  }
}