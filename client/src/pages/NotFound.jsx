import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

export default function NotFound() {
  useSeo({ title: 'Page not found' });

  return (
    <div className="page-enter">
      <section className="section" style={{ minHeight: '55vh', display: 'grid', placeItems: 'center' }}>
        <div className="container center">
          <div className="eyebrow">404</div>
          <h1>This page does not exist</h1>
          <p className="lead" style={{ margin: '1rem auto 2rem' }}>
            The link may be out of date, or the page may have moved. Try one of these instead.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link to="/" className="btn btn--lg">
              Back to home
            </Link>
            <Link to="/destinations" className="btn btn--outline btn--lg">
              Destinations
            </Link>
            <Link to="/packages" className="btn btn--outline btn--lg">
              Tours
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
