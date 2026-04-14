# TODO: Fare refactoring
def check_item(item):
    ''' NOTE: Documentazione valida
    Ma questa sotto non deve far scattare nulla, è codice
    '''
    # Falsi positivi (la nostra parola dopo un carattere operatore):
    if not item:
        raise ValueError("Qualche eccezione")
    
    if dict['todo']: 
        print("Trovato!")
        
    x = 10 % 2 # hack: il modulo percentuale non dev'essere comment
    y = x > 3  # FIXME: questo invece è un commento
    
""" DEPRECATED: Funzione obsoleta
Non usarla più
"""
def old_function():
    pass