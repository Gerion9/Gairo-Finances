import React from 'react';
import SavingsCatalog from './SavingsCatalog';
import { mexicoSavingsCatalog } from '../data/mexicoSavingsCatalog';

export default function SavingsCatalogRoute({ catalog = mexicoSavingsCatalog, ...props }) {
  return <SavingsCatalog {...props} catalog={catalog} />;
}
