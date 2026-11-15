import { Icon, type IconName } from './icons'

export function ComingSoon({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <section className="rounded-card bg-surface px-5 py-8 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-fill text-tint">
        <Icon name={icon} active className="size-7" />
      </div>
      <h2 className="mt-4 text-[1.25rem] leading-tight font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="mx-auto mt-2 max-w-[32ch] text-label-2">{text}</p>
    </section>
  )
}
