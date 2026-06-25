interface AlertBannerProps {
  show: boolean;
  title: string;
}

export function AlertBanner({ show, title }: AlertBannerProps) {
  return (
    <div className={`banner ${show ? "show" : ""}`}>
      <div className="ar">الله أكبر</div>
      <div className="tx">
        <b>{title}</b>
        <div>It is time to pray</div>
      </div>
    </div>
  );
}
