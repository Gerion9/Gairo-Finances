import React from 'react';
import CreditLibrary from './CreditLibrary';
import { creditCatalog } from '../data/creditCatalog';

export default function CreditLibraryRoute({ catalog = creditCatalog, ...props }) {
  return <CreditLibrary {...props} catalog={catalog} />;
}
