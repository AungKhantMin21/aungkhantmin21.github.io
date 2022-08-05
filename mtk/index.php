<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skin O'Clock</title>
    <link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.0/css/bootstrap.css' integrity='sha512-h1rwF0uB6r2IuEZcyjPrR53bBKN9Wb4yL+w3Rdlzmc3CkBF1gMSFvQIIstnu4bEtYDaKca5ke5S8UBAACRImyg==' crossorigin='anonymous'/>
    <link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.2/css/all.css' integrity='sha512-9nqhm3FWfB00id4NJpxK/wV1g9P2QfSsEPhSSpT+6qrESP6mpYbTfpC+Jvwe2XY27K5mLwwrqYuzqMGK5yC9/Q==' crossorigin='anonymous'/>
    <link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/hover.css/2.3.1/css/hover.css'/>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <!-- Navbar for desktop version -->
    <div class="col-md-12 d-lg-block d-xl-block d-none shadow-sm bg-light">
        <div class="container pr-4">
            <div class="row py-4">
                <div class="col-md-5 pr-0">
                    <nav class="nav mt-2">
                        <a class="nav-link text-dark text-uppercase" aria-current="page" href="#">Home</a>
                        <a class="nav-link text-dark text-uppercase" href="#">Shop</a>
                        <a class="nav-link text-dark text-uppercase" href="#">About</a>
                        <a class="nav-link text-dark text-uppercase">Blog</a>
                    </nav>
                </div>
                <div class="col-md-2 px-0">
                    <h4 class="my-0 text-center text-uppercase fst-italic">Skin O'<br>Clock</h4>
                </div>
                <div class="col-md-5 px-0">
                    <nav class="nav mt-2 float-end">
                        <a class="nav-link text-dark text-uppercase iconClass" aria-current="page" href="#"><i class="fa-solid fa-heart fs-4" id="wishlist-icon"></i><span class="badge bg-danger rounded-pill">0</span></a></a>
                        <a class="nav-link text-dark text-uppercase iconClass" href="#"><i class="fa-solid fa-bag-shopping fs-4"></i><span class="badge bg-danger rounded-pill">0</span></a>
                        <a class="nav-link text-dark text-uppercase" href="#">LOG IN</a>
                    </nav>
                </div>
            </div>
        </div>
    </div>

    <!-- navbar for mobile version -->
    <nav class="navbar navbar-expand-lg bg-light d-lg-none d-xl-none shadow-sm sticky-top">
        <div class="container-fluid">
            <a class="navbar-brand" href="#">Skin O'Clock</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="offcanvas" data-bs-target="#staticBackdrop" aria-controls="staticBackdrop">
                <span class="navbar-toggler-icon"></span>
            </button>
        </div>
    </nav>

    <!-- offcanvas menu for mobile version -->
    <div class="offcanvas-lg offcanvas-end d-lg-none d-xl-none" data-bs-backdrop="static" tabindex="-1" id="staticBackdrop" aria-labelledby="staticBackdropLabel">
        <div class="offcanvas-header bg-dark">
            <h5 class="offcanvas-title text-light">MENU</h5>
            <button type="button" class="btn-close bg-light rounded-pill" data-bs-dismiss="offcanvas" data-bs-target="#staticBackdrop" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
            <nav class="nav flex-column">
                <a class="nav-link text-dark text-uppercase" href="#">Home</a>
                <a class="nav-link text-dark text-uppercase" href="#">Shop</a>
                <a class="nav-link text-dark text-uppercase" href="#">About</a>
                <a class="nav-link text-dark text-uppercase" href="#">Blog</a>
                <a class="nav-link text-dark text-uppercase iconClass" href="#">WISHLIST <i class="fa-solid fa-heart fs-4" id="wishlist-icon"></i><span class="badge bg-danger rounded-pill">0</span></a></a>
                <a class="nav-link text-dark text-uppercase iconClass" href="#">CART <i class="fa-solid fa-bag-shopping fs-4"></i><span class="badge bg-danger rounded-pill">0</span></a>
                <a class="nav-link text-dark text-uppercase" href="#">LOG IN</a>
            </nav>
        </div>
    </div>



    <header id="header-home" class="img-background mb-5">
        <div class="container h-100">
            <div class="row h-100 align-items-center">
                <div class="col-7 mx-auto text-center text-dark p-4">
                    <h1 class="text-uppercase" style="font-size: 50px; text-shadow: 2.5px 2.5px #7f7f7f;">Be your own kind of <br>beautiful</h1>

                    <a class="btn mt-5 px-4 py-3 rounded-0 shadow-sm primary-btn" href="#">SHOP NOW</a>
                </div>
            </div>
        </div>
    </header>

    <div class="container mt-5">
        <div class="row mt-4">
            <div class="col-md-6 py-5">
                <img src="images/photo-1.jpg" style="filter:brightness(97%);"class="img-fluid" alt="">
            </div>
            <div class="col-md-6 p-5 d-flex align-items-center">
                <div>
                    <h3 class="fw-light color-1">SOFT AND FEATHERY TOUCH</h3>
                    <h1>ENHANCE YOU BEAUTY</h1>
                    <p>Consectetur adipiscing elit ut aliquam purus sit amet luctus. Risus nec feugiat in fermentum posuere. Leo in vitae turpis massa sed elementum tempus egestas sed. Aliquam vestibulum morbi blandit cursus.</p>
                    <button class="rounded-0 secondary-btn btn">BUY NOW</button>
                </div>
                
            </div>
        </div>
    </div>

    <div class="primary-bg mt-5">
        <div class="container py-5">
            <h4 class="fw-light color-1 text-center">GORGEOUS AND AFFORDABLE</h4>
            <h1 class="border-bottom mx-auto pb-2 text-uppercase" style="width: fit-content;">Best Sellers</h1>
            <div class="row mt-3">
                <?php for($i=1; $i<=6; $i++){  ?>

                
                <div class="col-md-4 mx-auto mt-5">
                    <div class="overflow-hidden" style="height:400px;">
                        <img src="images/photo-2.jpg" alt="" class="img-fluid hvr-grow">
                    </div>
                    <h5 class="mt-3 text-center">$ 12.00</h5>
                    <h4 class="mt-2 text-center fw-bold ">Super Glow</h4>
                    <p class="text-center">
                        <i class="fa-solid fa-star color-1"></i>
                        <i class="fa-solid fa-star color-1"></i>
                        <i class="fa-solid fa-star color-1"></i>
                        <i class="fa-solid fa-star-half-stroke color-1"></i>
                    </p>
                    <div class="text-center">
                        <button class="btn rounded-0 secondary-btn">DETAILS</button>
                    </div>
                    
                </div>
                <?php } ?>
            </div>
        </div>
    </div>



    <script src='https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.0/js/bootstrap.js' integrity='sha512-39Q5Yw4jtWPVkYu5Dry3HiRh6DWG4FDODb/rHF+X2Xp0kzhg9VgTyYV209uQ/EsqPDP/4dDvwm1rb8JgnAkHNg==' crossorigin='anonymous'></script>
</body>
</html>